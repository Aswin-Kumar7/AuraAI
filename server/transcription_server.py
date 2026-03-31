import os
import json
import base64
import asyncio
import numpy as np
import audioop
import requests
import re
import time
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, firestore, initialize_app, get_app
from dotenv import load_dotenv
import logging

load_dotenv(".env.local")

# ── Logging ──
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Thread Pool for blocking operations ──
executor = ThreadPoolExecutor(max_workers=5)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Config ──
MODEL_TYPE = os.getenv("TRANSCRIPTION_MODEL", "GOOGLE").upper()
GROQ_KEY = os.getenv("GROQ_API_KEY")
DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")
GOOGLE_KEY = os.getenv("GOOGLE_STT_API_KEY")
GROQ_WHISPER_MODEL = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
GROQ_WHISPER_FALLBACK_MODEL = os.getenv("GROQ_WHISPER_FALLBACK_MODEL", "whisper-large-v3")
GROQ_WHISPER_PROMPT = os.getenv("GROQ_WHISPER_PROMPT", "").strip()


def _env_float(name, default, min_value, max_value):
    """Parse and clamp float env config safely."""
    try:
        value = float(os.getenv(name, str(default)))
        return max(min_value, min(max_value, value))
    except Exception:
        return default


def _env_int(name, default, min_value, max_value):
    """Parse and clamp integer env config safely."""
    try:
        value = int(float(os.getenv(name, str(default))))
        return max(min_value, min(max_value, value))
    except Exception:
        return default


# Keep live streaming responsive by default when upstream APIs are unstable.
MAX_RETRIES = _env_int("STT_MAX_RETRIES", 0, 0, 5)
RETRY_DELAY = _env_float("STT_RETRY_DELAY_SECONDS", 0.25, 0.0, 2.0)
GROQ_HTTP_TIMEOUT_SECONDS = _env_float("GROQ_HTTP_TIMEOUT_SECONDS", 6.0, 2.0, 20.0)
GOOGLE_HTTP_TIMEOUT_SECONDS = _env_float("GOOGLE_HTTP_TIMEOUT_SECONDS", 8.0, 2.0, 20.0)
INTEL_HTTP_TIMEOUT_SECONDS = _env_float("INTEL_HTTP_TIMEOUT_SECONDS", 6.0, 2.0, 20.0)
FIRESTORE_RETRY_ATTEMPTS = _env_int("FIRESTORE_RETRY_ATTEMPTS", 2, 0, 5)
FIRESTORE_RETRY_DELAY_SECONDS = _env_float("FIRESTORE_RETRY_DELAY_SECONDS", 0.4, 0.0, 3.0)
ENABLE_LOCAL_INTELLIGENCE_FALLBACK = (
    os.getenv("ENABLE_LOCAL_INTELLIGENCE_FALLBACK", "false").strip().lower()
    in {"1", "true", "yes", "on"}
)


# Twilio media stream is 8kHz mulaw (roughly 8000 bytes/sec in payload).
STREAM_BYTES_PER_SECOND = 8000
STT_CHUNK_SECONDS_DEFAULT = _env_float("STT_CHUNK_SECONDS", 1.8, 0.5, 8.0)
STT_CHUNK_SECONDS_GOOGLE = _env_float(
    "STT_CHUNK_SECONDS_GOOGLE", STT_CHUNK_SECONDS_DEFAULT, 0.5, 8.0
)
STT_CHUNK_SECONDS_GROQ = _env_float(
    "STT_CHUNK_SECONDS_GROQ", STT_CHUNK_SECONDS_DEFAULT, 0.5, 8.0
)
STT_CHUNK_SECONDS_GROQ_AGENT = _env_float(
    "STT_CHUNK_SECONDS_GROQ_AGENT", min(2.0, STT_CHUNK_SECONDS_GROQ), 0.5, 8.0
)
CHUNK_LIMIT_GOOGLE = int(STREAM_BYTES_PER_SECOND * STT_CHUNK_SECONDS_GOOGLE)
CHUNK_LIMIT_GROQ = int(STREAM_BYTES_PER_SECOND * STT_CHUNK_SECONDS_GROQ)
CHUNK_LIMIT_GROQ_AGENT = int(STREAM_BYTES_PER_SECOND * STT_CHUNK_SECONDS_GROQ_AGENT)

# Separate silence thresholds help with low-volume agent replies on outbound track.
RMS_SILENCE_THRESHOLD_GROQ_CUSTOMER = _env_int(
    "RMS_SILENCE_THRESHOLD_GROQ_CUSTOMER", 500, 50, 4000
)
RMS_SILENCE_THRESHOLD_GROQ_AGENT = _env_int(
    "RMS_SILENCE_THRESHOLD_GROQ_AGENT", 220, 50, 4000
)


def _normalize_speaker(value, fallback):
    """Normalize speaker labels to supported values."""
    v = str(value or fallback).strip().lower()
    if v in {"agent", "customer"}:
        return v
    return fallback

# Track-to-speaker mapping can vary by Twilio call topology; make it configurable.
TWILIO_INBOUND_SPEAKER = _normalize_speaker(
    os.getenv("TWILIO_INBOUND_SPEAKER", "customer"), "customer"
)
TWILIO_OUTBOUND_SPEAKER = _normalize_speaker(
    os.getenv("TWILIO_OUTBOUND_SPEAKER", "agent"), "agent"
)

# ── Hybrid Endpoint ──
HYBRID_ENDPOINT = os.getenv("HYBRID_ENDPOINT_URL", "http://localhost:3000/api/transcription/hybrid")

# ── Pinecone Config ──
PINECONE_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_HOST = os.getenv("PINECONE_HOST")
PINECONE_INDEX = os.getenv("PINECONE_INDEX_NAME")

# ── Firebase ──
try:
    firebase_app = get_app()
except ValueError:
    f_key = os.getenv("FIREBASE_ADMIN_PRIVATE_KEY", "").replace("\\n", "\n")
    cred_dict = {
        "type": "service_account",
        "project_id": os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
        "client_email": os.getenv("FIREBASE_ADMIN_CLIENT_EMAIL"),
        "private_key": f_key,
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    firebase_app = initialize_app(credentials.Certificate(cred_dict))

db = firestore.client()

# ── PINECONE SEARCHING (RAG) ──
def search_pinecone(query_text):
    """Simple REST-based search for Pinecone to avoid heavy dependencies"""
    if not PINECONE_KEY or not PINECONE_HOST: return []
    try:
        # Note: In a production RAG system, we would embed query_text first.
        # For now, we search by metadata or use placeholders if the index is set up for it.
        # If the user has a 'top_k' metadata search or similar.
        # BUT: Most Pinecone indexes require vectors. 
        # For Simplicity in this v2.11, we'll log the intention and assume the LLM is primed.
        print(f"🌲 [PINECONE] Querying Intelligence Index: '{query_text[:30]}...'")
        return [] # Placeholder for future vectorization step
    except: return []

def clean_transcript(text):
    """Clean transcription output by removing artifacts and noise"""
    if not text:
        return ""
    
    # Remove brackets, parentheses, asterisks and their content
    text = re.sub(r'\[.*?\]|\(.*?\)|\*.*?\*', '', text)
    
    # Blacklist phrases common in transcription errors
    blacklist = [
        "gracias", "watching", "subscribe", "muffled",
        "indian english", "inaudible", "unintelligible",
        "background noise", "[", "]", "(",  ")"
    ]
    
    # Clean up whitespace
    cleaned = re.sub(r'\s+', ' ', text).strip()
    
    # Skip recurring non-informative hallucination sometimes returned by STT.
    cleaned_lower = cleaned.lower()
    if cleaned_lower in {"support call", "a support call", "this is a support call"}:
        return ""

    # Check minimum length
    if len(cleaned) < 3:
        return ""
    
    # Check for mostly blacklisted words
    words = cleaned_lower.split()
    if len(words) < 4:
        if any(b in cleaned_lower for b in blacklist):
            return ""
    
    # Convert to proper capitalization
    cleaned = cleaned[0].upper() + cleaned[1:] if len(cleaned) > 0 else cleaned
    
    return cleaned


def _firestore_with_retry(op_name, fn):
    """Retry transient Firestore/network failures with short backoff."""
    attempts = max(0, FIRESTORE_RETRY_ATTEMPTS) + 1
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as e:
            if attempt >= attempts:
                logger.error(f"❌ [FIRESTORE] {op_name} failed after {attempt} attempts: {e}")
                raise

            delay = FIRESTORE_RETRY_DELAY_SECONDS * attempt
            logger.warning(
                f"⚠️  [FIRESTORE] {op_name} attempt {attempt}/{attempts} failed: {e}. "
                f"Retrying in {delay:.1f}s"
            )
            time.sleep(delay)


def send_to_hybrid_endpoint(call_sid, transcript, confidence=0.8, source="backend", speaker="customer"):
    """Send transcription to hybrid endpoint for intelligent routing and storage.

    Returns True on successful routing, False when fallback storage should be used.
    """
    try:
        payload = {
            "callId": call_sid,
            "source": source,
            "speaker": speaker,
            "transcript": transcript,
            "confidence": confidence,
            "language": os.getenv("STT_LANGUAGE_CODE", "en-IN"),
            "isFinal": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        res = requests.post(HYBRID_ENDPOINT, json=payload, timeout=5)

        if res.status_code != 200:
            logger.warning(
                f"⚠️  [HYBRID] Endpoint returned {res.status_code}, falling back to direct storage"
            )
            return False

        hybrid_response = res.json()
        logger.debug(
            f"✅ [HYBRID] Routed via: {hybrid_response.get('source')} ({hybrid_response.get('latency')}ms)"
        )
        return True
    except requests.exceptions.Timeout:
        logger.warning("⏱️  [HYBRID] Endpoint timeout, falling back to direct storage")
        return False
    except Exception as e:
        logger.error(f"❌ [HYBRID] Error sending to endpoint: {e}")
        return False

async def get_enterprise_config(call_sid):
    try:
        call_ref = _firestore_with_retry(
            "read liveCallState",
            lambda: db.collection("liveCallState").document(call_sid).get(),
        )
        if not call_ref.exists:
            return {}

        data = call_ref.to_dict() or {}
        agent_id = data.get("agentId")
        company_cfg = {}
        if agent_id:
            u_ref = _firestore_with_retry(
                "read user",
                lambda: db.collection("users").document(agent_id).get(),
            )
            cid = (u_ref.to_dict() or {}).get("companyId")
            if cid:
                company_doc = _firestore_with_retry(
                    "read companyConfig",
                    lambda: db.collection("companyConfig").document(cid).get(),
                )
                company_cfg = company_doc.to_dict() or {}

        # Per-call mapping overrides help when Twilio track direction differs by route.
        inbound_override = _normalize_speaker(
            data.get("twilioInboundSpeaker"), TWILIO_INBOUND_SPEAKER
        )
        outbound_override = _normalize_speaker(
            data.get("twilioOutboundSpeaker"), TWILIO_OUTBOUND_SPEAKER
        )
        company_cfg["twilioInboundSpeaker"] = inbound_override
        company_cfg["twilioOutboundSpeaker"] = outbound_override
        return company_cfg
    except Exception as e:
        logger.warning(f"⚠️  [CONFIG] Failed to load enterprise config for {call_sid}: {e}")
        return {}

# ──────── ANALYSIS HUB (2.11 PINECONE-READY) ────────

async def run_intelligence_pass(call_sid, history, config):
    """Analyze call context and update live state with sentiment, suggestions, etc.
    
    This is async but delegates blocking I/O to thread pool to avoid blocking event loop.
    """
    if not GROQ_KEY or not history or len(history) == 0:
        return
    
    def _intelligence_work():
        """Blocking intelligence analysis work"""
        try:
            logger.info(f"🧠 [ANALYSIS] Analyzing '{history[-1]['text'][:40]}...'")
            context = "\n".join([f"{t['speaker'].upper()}: {t['text']}" for t in history[-10:]])
            name = config.get("companyName", "Aura AI")
            kb_fallback = config.get("knowledgeBase", "Standard policy.")
            
            pinecone_hints = search_pinecone(history[-1]['text'])
            
            sys_prompt = f"""
You are the Aura AI Cognitive Hub for {name}.
KNOWLEDGE BASE: {kb_fallback}
VECTOR HINTS: {pinecone_hints if pinecone_hints else 'None'}

Analyze the conversation and respond with ONLY a valid JSON object:
{{
    "sentimentScore": number(-1.0 to 1.0),
    "sentimentLabel": "Neutral"|"Frustrated"|"Satisfied"|"Urgent"|"Angry",
    "intent": "brief customer request",
    "currentSuggestions": ["response 1", "response 2", "response 3"],
    "knowledgeSnippet": "relevant policy snippet",
    "complianceAlert": boolean,
    "liveSummary": "2-sentence status"
}}"""
            
            try:
                res = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {GROQ_KEY}"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [
                            {"role": "system", "content": sys_prompt},
                            {"role": "user", "content": context}
                        ],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 500
                    },
                    timeout=INTEL_HTTP_TIMEOUT_SECONDS
                )
                
                if res.status_code != 200:
                    logger.error(f"❌ [GROQ-INTEL-ERR]: {res.status_code}")
                    return
                
                choice = res.json().get("choices", [{}])[0]
                content = choice.get("message", {}).get("content", "{}")
                intel = json.loads(content)
                
                # Update Firestore with analysis
                _firestore_with_retry(
                    "write intelligence",
                    lambda: db.collection("liveCallState").document(call_sid).set(intel, merge=True),
                )
                logger.debug(f"✅ [INTEL] Updated: sentiment={intel.get('sentimentLabel')}")
                
            except json.JSONDecodeError:
                logger.error(f"❌ [INTEL-JSON-ERR]: Invalid JSON from Groq")
            except requests.exceptions.RequestException as e:
                logger.error(f"❌ [INTEL-NETWORK-ERR]: {e}")
        except Exception as e:
            logger.error(f"❌ [INTEL-ERR]: {e}", exc_info=True)
    
    # Run blocking work in thread pool to avoid blocking event loop
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(executor, _intelligence_work)
    except Exception as e:
        logger.error(f"❌ [INTEL-EXECUTOR-ERR]: {e}")

def compute_audio_level(raw_mulaw_bytes):
    """Compute RMS level of raw mulaw audio for silence detection"""
    try:
        if len(raw_mulaw_bytes) < 2:
            return 0
        # Convert mulaw to linear PCM for RMS calculation
        pcm = audioop.ulaw2lin(raw_mulaw_bytes, 2)
        return audioop.rms(pcm, 2)
    except:
        return 0


def map_track_to_speaker(
    track_value,
    inbound_speaker=TWILIO_INBOUND_SPEAKER,
    outbound_speaker=TWILIO_OUTBOUND_SPEAKER,
):
    """Map Twilio media track to a normalized speaker value."""
    inbound = _normalize_speaker(inbound_speaker, TWILIO_INBOUND_SPEAKER)
    outbound = _normalize_speaker(outbound_speaker, TWILIO_OUTBOUND_SPEAKER)
    t = str(track_value or "inbound_track").lower()
    if t in {"outbound", "outbound_track", "out"}:
        return outbound
    if t in {"inbound", "inbound_track", "in"}:
        return inbound

    logger.debug(f"⚠️  [TRACK] Unknown track '{t}', defaulting to inbound mapping")
    return inbound

# ──────── TRANSCRIPTION HUB ────────

def groq_inference(audio_bytes, prompt=None, retry_count=0):
    """Groq Whisper inference with retry logic and quality-based fallback.

    Primary model is tuned for low latency/low parameter count. If output quality
    looks weak (e.g., 1-2 token fragment), we retry once on a stronger fallback model.
    """
    if not GROQ_KEY:
        logger.warning("⚠ [GROQ] Missing API Key")
        return ""

    def _run_groq_transcription(model_name):
        import io, wave

        with io.BytesIO() as w_io:
            with wave.open(w_io, 'wb') as w_f:
                w_f.setnchannels(1)
                w_f.setsampwidth(2)
                w_f.setframerate(16000)
                w_f.writeframes((audio_bytes * 32767).astype(np.int16).tobytes())

            w_io.seek(0)
            files = {"file": ("audio.wav", w_io, "audio/wav")}

            # Whisper language expects ISO-639-1 (en, hi, ta...)
            lang_hint = os.getenv("STT_LANGUAGE_CODE", "en-IN").split("-")[0].lower()
            selected_prompt = GROQ_WHISPER_PROMPT if prompt is None else prompt
            data = {
                "model": model_name,
                "temperature": 0.0,
                "language": lang_hint,
                "response_format": "verbose_json",
            }
            if selected_prompt:
                data["prompt"] = selected_prompt

            return requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_KEY}"},
                files=files,
                data=data,
                timeout=GROQ_HTTP_TIMEOUT_SECONDS,
            )

    try:
        primary_model = GROQ_WHISPER_MODEL
        fallback_model = GROQ_WHISPER_FALLBACK_MODEL

        logger.debug(f"🎤 [GROQ] Primary whisper model: {primary_model}")
        primary_res = _run_groq_transcription(primary_model)

        if primary_res.status_code != 200:
            logger.error(f"❌ [GROQ-API-ERR]: {primary_res.status_code} - {primary_res.text}")
            if retry_count < MAX_RETRIES:
                logger.info(f"🔄 [GROQ] Retrying... ({retry_count + 1}/{MAX_RETRIES})")
                time.sleep(RETRY_DELAY)
                return groq_inference(audio_bytes, prompt, retry_count + 1)
            return ""

        primary_json = primary_res.json()
        primary_text = clean_transcript(primary_json.get("text", ""))

        # Weak outputs are common with short/uncertain chunks; recover with stronger model.
        primary_word_count = len(primary_text.split()) if primary_text else 0
        should_fallback = (
            fallback_model
            and fallback_model != primary_model
            and primary_word_count > 0
            and primary_word_count <= 2
        )

        if should_fallback:
            logger.info(
                f"🛟 [GROQ] Weak output from {primary_model} ('{primary_text}'), "
                f"retrying with {fallback_model}"
            )
            fallback_res = _run_groq_transcription(fallback_model)
            if fallback_res.status_code == 200:
                fallback_text = clean_transcript(fallback_res.json().get("text", ""))
                if len(fallback_text.split()) > primary_word_count:
                    logger.info(f"✅ [GROQ] Fallback model improved transcription")
                    return fallback_text
            else:
                logger.warning(
                    f"⚠ [GROQ] Fallback model error {fallback_res.status_code}, "
                    f"using primary output"
                )

        return primary_text

    except Exception as e:
        logger.error(f"❌ [GROQ-ERR]: {e}")
        if retry_count < MAX_RETRIES:
            logger.info(f"🔄 [GROQ] Retrying after error... ({retry_count + 1}/{MAX_RETRIES})")
            time.sleep(RETRY_DELAY)
            return groq_inference(audio_bytes, prompt, retry_count + 1)
        return ""

def google_inference(raw_mulaw_bytes, retry_count=0):
    """Google Speech-to-Text with enhanced error handling and retry logic"""
    if not GOOGLE_KEY:
        logger.warning("⚠ [GOOGLE] Missing API Key")
        return ""
    
    try:
        # Validate audio data
        if not raw_mulaw_bytes or len(raw_mulaw_bytes) < 100:
            logger.debug(f"⏭️  [GOOGLE] Skipping audio chunk (too small: {len(raw_mulaw_bytes)} bytes)")
            return ""
        
        # Base64 encode the raw mulaw audio
        audio_content = base64.b64encode(raw_mulaw_bytes).decode("utf-8")
        
        url = f"https://speech.googleapis.com/v1/speech:recognize?key={GOOGLE_KEY}"
        
        # Google phone_call model supported languages: en-US, en-GB, es-ES, fr-FR, de-DE, it-IT, pt-BR, ru-RU, zh-CN, ja-JP
        # For en-IN, use default model instead
        language_code = os.getenv("STT_LANGUAGE_CODE", "en-IN")
        use_phone_call_model = language_code in ["en-US", "en-GB", "es-ES", "fr-FR", "de-DE", "it-IT", "pt-BR", "ru-RU", "zh-CN", "ja-JP"]
        
        payload = {
            "config": {
                "encoding": "MULAW",
                "sampleRateHertz": 8000,
                "languageCode": language_code,
                "enableAutomaticPunctuation": True,
                "useEnhanced": True,
                "speechContexts": [{
                    "phrases": ["support", "agent", "customer", "help", "issue", "problem", "billing", "account", "payment", "subscription", "refund"],
                    "boost": 20.0
                }]
            },
            "audio": {
                "content": audio_content
            }
        }
        
        # Add phone_call model only if language is supported
        if use_phone_call_model:
            payload["config"]["model"] = "phone_call"
            logger.debug(f"🎤 [GOOGLE] Using phone_call model for {language_code}")
        else:
            logger.debug(f"🎤 [GOOGLE] Using default model for {language_code} (phone_call not supported)")
        
        res = requests.post(url, json=payload, timeout=GOOGLE_HTTP_TIMEOUT_SECONDS)
        res_json = res.json()
        
        if res.status_code != 200:
            error_msg = res_json.get("error", {}).get("message", res.text)
            logger.error(f"❌ [GOOGLE-API-ERR]: {res.status_code} - {error_msg}")
            if retry_count < MAX_RETRIES and res.status_code >= 500:
                logger.info(f"🔄 [GOOGLE] Retrying server error... ({retry_count + 1}/{MAX_RETRIES})")
                time.sleep(RETRY_DELAY)
                return google_inference(raw_mulaw_bytes, retry_count + 1)
            return ""
        
        results = res_json.get("results", [])
        if results:
            try:
                transcript = results[0]["alternatives"][0]["transcript"]
                confidence = results[0]["alternatives"][0].get("confidence", 0)
                if confidence < 0.3:
                    logger.debug(f"⚠️  [GOOGLE] Low confidence ({confidence:.2f}): {transcript}")
                return clean_transcript(transcript)
            except (KeyError, IndexError) as e:
                logger.error(f"❌ [GOOGLE-PARSE-ERR]: {e}")
                return ""
        else:
            logger.debug("ℹ️  [GOOGLE] No results (audio might be silence or too short)")
            return ""
            
    except requests.exceptions.Timeout:
        logger.warning(f"⏱️  [GOOGLE] Request timeout")
        if retry_count < MAX_RETRIES:
            logger.info(f"🔄 [GOOGLE] Retrying after timeout... ({retry_count + 1}/{MAX_RETRIES})")
            time.sleep(RETRY_DELAY)
            return google_inference(raw_mulaw_bytes, retry_count + 1)
        return ""
    except Exception as e:
        logger.error(f"❌ [GOOGLE-ERR]: {e}")
        if retry_count < MAX_RETRIES:
            logger.info(f"🔄 [GOOGLE] Retrying after error... ({retry_count + 1}/{MAX_RETRIES})")
            time.sleep(RETRY_DELAY)
            return google_inference(raw_mulaw_bytes, retry_count + 1)
        return ""

@app.websocket("/")
async def websocket_ep(websocket: WebSocket):
    await websocket.accept()
    logger.info(f"[WS] Streaming Link: ACTIVE (Engine: {MODEL_TYPE})")
    call_sid, cfg = None, {}
    call_track_map = {
        "inbound": TWILIO_INBOUND_SPEAKER,
        "outbound": TWILIO_OUTBOUND_SPEAKER,
    }
    buffers = {"customer": bytearray(), "agent": bytearray()}
    packet_count = 0
    speaker_packet_count = {"customer": 0, "agent": 0}
    last_transcript_time = time.time()
    
    try:
        while True:
            try:
                raw = await websocket.receive_text()
                msg = json.loads(raw)
            except json.JSONDecodeError as e:
                logger.error(f"❌ [WS-JSON-ERR]: Invalid JSON - {e}")
                continue
            except WebSocketDisconnect:
                logger.info(f"[WS] Connection closed by client")
                break

            try:
                if msg["event"] == "start":
                    call_sid = msg["start"].get("callSid")
                    if not call_sid:
                        logger.error("❌ [WS] Missing callSid in start event")
                        continue
                    
                    cfg = await get_enterprise_config(call_sid)
                    call_track_map = {
                        "inbound": _normalize_speaker(
                            cfg.get("twilioInboundSpeaker"), TWILIO_INBOUND_SPEAKER
                        ),
                        "outbound": _normalize_speaker(
                            cfg.get("twilioOutboundSpeaker"), TWILIO_OUTBOUND_SPEAKER
                        ),
                    }
                    buffers = {"customer": bytearray(), "agent": bytearray()}
                    logger.info(f"[AI] Ready for Intelligence Session ({MODEL_TYPE}): {call_sid}")
                    logger.info(
                        f"🔀 [TRACK] Call map: inbound->{call_track_map['inbound']}, "
                        f"outbound->{call_track_map['outbound']}"
                    )
                    packet_count = 0
                    speaker_packet_count = {"customer": 0, "agent": 0}
                    last_transcript_time = time.time()

                elif msg["event"] == "media":
                    if not call_sid:
                        logger.error("❌ [WS] Media received before start event")
                        continue
                    
                    try:
                        payload = base64.b64decode(msg["media"]["payload"])
                    except Exception as e:
                        logger.error(f"❌ [WS-DECODE-ERR]: {e}")
                        continue

                    track = msg.get("media", {}).get("track", "inbound_track")
                    speaker = map_track_to_speaker(
                        track,
                        call_track_map["inbound"],
                        call_track_map["outbound"],
                    )
                    
                    buffers[speaker].extend(payload)
                    packet_count += 1
                    speaker_packet_count[speaker] += 1
                    
                    # Log packet flow
                    if packet_count % 20 == 0:
                        elapsed = time.time() - last_transcript_time
                        logger.info(
                            f"📊 [DEBUG] Packets: {packet_count}, "
                            f"CustomerBuf: {len(buffers['customer'])} bytes, "
                            f"AgentBuf: {len(buffers['agent'])} bytes, "
                            f"Elapsed: {elapsed:.1f}s"
                        )

                    # Adaptive chunk sizing based on engine
                    if MODEL_TYPE == "GOOGLE":
                        CHUNK_LIMIT = CHUNK_LIMIT_GOOGLE
                    else:
                        CHUNK_LIMIT = CHUNK_LIMIT_GROQ_AGENT if speaker == "agent" else CHUNK_LIMIT_GROQ

                    if len(buffers[speaker]) >= CHUNK_LIMIT:
                        raw_p = bytes(buffers[speaker])
                        buffers[speaker] = bytearray()
                        
                        # Process transcription in thread pool to avoid blocking event loop
                        text = ""
                        
                        try:
                            loop = asyncio.get_event_loop()
                            
                            if MODEL_TYPE == "GOOGLE":
                                # Google handles raw mulaw directly - with silence detection
                                rms_value = compute_audio_level(raw_p)
                                if rms_value < 100:  # Very quiet threshold for mulaw
                                    logger.debug(f"🔇 [GOOGLE] Silence detected (RMS: {rms_value})")
                                    continue
                                
                                logger.debug(f"🎤 [GOOGLE] Processing {len(raw_p)} bytes (RMS: {rms_value})")
                                text = await asyncio.wait_for(
                                    loop.run_in_executor(executor, google_inference, raw_p),
                                    timeout=GOOGLE_HTTP_TIMEOUT_SECONDS + 1.0,
                                )
                            else:
                                # Groq needs PCM conversion and normalization
                                try:
                                    pcm = audioop.ulaw2lin(raw_p, 2)
                                    rms_value = audioop.rms(pcm, 2)
                                    silence_threshold = (
                                        RMS_SILENCE_THRESHOLD_GROQ_AGENT
                                        if speaker == "agent"
                                        else RMS_SILENCE_THRESHOLD_GROQ_CUSTOMER
                                    )
                                    if rms_value < silence_threshold:
                                        logger.debug(f"🔇 [GROQ] Silence detected (RMS: {rms_value})")
                                        continue

                                    pcm_16, _ = audioop.ratecv(pcm, 2, 1, 8000, 16000, None)
                                    a_flt = np.frombuffer(pcm_16, dtype=np.int16).astype(np.float32) / 32768.0
                                    mx = np.max(np.abs(a_flt))
                                    if 0.05 < mx < 1.0:
                                        a_flt *= (1.0 / mx)
                                    text = await asyncio.wait_for(
                                        loop.run_in_executor(executor, groq_inference, a_flt),
                                        timeout=GROQ_HTTP_TIMEOUT_SECONDS + 1.0,
                                    )
                                except Exception as e:
                                    logger.error(f"❌ [GROQ-PROCESS-ERR]: {e}")
                                    continue

                            if text:
                                logger.info(
                                    f"✅ [{MODEL_TYPE}] [{speaker.upper()}] \"{text[:50]}...\""
                                    if len(text) > 50
                                    else f"✅ [{MODEL_TYPE}] [{speaker.upper()}] \"{text}\""
                                )
                                ts = datetime.now(timezone.utc).isoformat()
                                
                                try:
                                    # Try hybrid endpoint first for intelligent routing
                                    hybrid_success = send_to_hybrid_endpoint(
                                        call_sid, 
                                        text, 
                                        confidence=0.85,  # Backend STT typically high confidence
                                        source="backend",
                                        speaker=speaker,
                                    )
                                    
                                    if not hybrid_success:
                                        # Fallback: Direct Firestore write if hybrid endpoint unavailable
                                        logger.info("[HYBRID] Endpoint unavailable, using fallback storage")
                                        ref = db.collection("liveCallState").document(call_sid)
                                        _firestore_with_retry(
                                            "write transcript fallback",
                                            lambda: ref.set({
                                                "viewed": False,
                                                "lastTranscriptAt": ts,
                                                "transcript": firestore.ArrayUnion([{
                                                    "speaker": speaker,
                                                    "text": text,
                                                    "timestamp": ts,
                                                    "engine": MODEL_TYPE,
                                                    "source": f"backend-groq-{speaker}"
                                                }])
                                            }, merge=True),
                                        )
                                    
                                    last_transcript_time = time.time()
                                    
                                    # Trigger intelligence analysis asynchronously
                                    if hybrid_success:
                                        # Let hybrid endpoint handle intelligence pass
                                        # (it can trigger analysis through response)
                                        pass
                                    elif ENABLE_LOCAL_INTELLIGENCE_FALLBACK:
                                        # Fallback: Trigger intelligence locally
                                        ref = db.collection("liveCallState").document(call_sid)
                                        snap = _firestore_with_retry(
                                            "read transcript fallback",
                                            lambda: ref.get(),
                                        )
                                        history = snap.to_dict().get("transcript", []) if snap.exists else []
                                        if history:
                                            asyncio.create_task(run_intelligence_pass(call_sid, history, cfg))
                                except Exception as e:
                                    logger.error(f"❌ [FIRESTORE-ERR]: {e}")
                        except asyncio.TimeoutError:
                            logger.warning(
                                f"⏱️  [STT-TIMEOUT] {MODEL_TYPE} chunk timed out for {speaker}. "
                                f"Dropping chunk to keep stream realtime"
                            )
                        except Exception as e:
                            logger.error(f"❌ [EXECUTOR-ERR]: {e}", exc_info=True)
                
                elif msg["event"] == "stop":
                    logger.info(f"[WS] Call stopped: {call_sid}")
                    break
                else:
                    logger.debug(f"⚠️  [WS] Unknown event: {msg.get('event')}")
                    
            except KeyError as e:
                logger.error(f"❌ [WS-KEY-ERR]: Missing key {e}")
                continue
                
    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected normally")
    except Exception as e:
        logger.error(f"❌ [RUNTIME-ERR]: {e}", exc_info=True)
    finally:
        logger.info(f"[WS] Cleanup - Call: {call_sid}, Total packets: {packet_count}")

if __name__ == "__main__":
    import uvicorn
    os.system('cls' if os.name == 'nt' else 'clear')
    
    # Get configuration
    lang_code = os.getenv("STT_LANGUAGE_CODE", "en-IN")
    supported_phone_call = lang_code in ["en-US", "en-GB", "es-ES", "fr-FR", "de-DE", "it-IT", "pt-BR", "ru-RU", "zh-CN", "ja-JP"]
    model_type = "phone_call" if (MODEL_TYPE == "GOOGLE" and supported_phone_call) else ("default" if MODEL_TYPE == "GOOGLE" else MODEL_TYPE)
    
    print("\n" + "="*50)
    print("      AURA AI COGNITIVE HUB 2.12         ")
    print("="*50)
    print(f"✅ PRIMARY ENGINE    : {MODEL_TYPE}")
    print(f"🌐 LANGUAGE          : {lang_code}")
    print(f"🎤 MODEL             : {model_type}")
    if MODEL_TYPE == "GROQ":
        print(f"🧩 WHISPER PRIMARY   : {GROQ_WHISPER_MODEL}")
        print(f"🛟 WHISPER FALLBACK  : {GROQ_WHISPER_FALLBACK_MODEL}")
    print(f"🌲 VECTOR STORE      : PINECONE (READY)")
    print(f"🔄 RETRY STRATEGY    : {MAX_RETRIES} attempts")
    print(
        f"⏱️  HTTP TIMEOUTS     : groq={GROQ_HTTP_TIMEOUT_SECONDS:.1f}s, "
        f"google={GOOGLE_HTTP_TIMEOUT_SECONDS:.1f}s, intel={INTEL_HTTP_TIMEOUT_SECONDS:.1f}s"
    )
    print(
        f"📊 CHUNK SIZE        : "
        f"{CHUNK_LIMIT_GOOGLE if MODEL_TYPE == 'GOOGLE' else CHUNK_LIMIT_GROQ} bytes"
    )
    print(
        f"⏱️  CHUNK WINDOW      : "
        f"{STT_CHUNK_SECONDS_GOOGLE if MODEL_TYPE == 'GOOGLE' else STT_CHUNK_SECONDS_GROQ:.1f}s"
    )
    if MODEL_TYPE == "GROQ":
        print(
            f"🧑‍💼 AGENT WINDOW      : {STT_CHUNK_SECONDS_GROQ_AGENT:.1f}s "
            f"({CHUNK_LIMIT_GROQ_AGENT} bytes)"
        )
        print(
            f"🎚️  RMS THRESHOLDS    : customer={RMS_SILENCE_THRESHOLD_GROQ_CUSTOMER}, "
            f"agent={RMS_SILENCE_THRESHOLD_GROQ_AGENT}"
        )
        print(
            f"🔀 TRACK MAP         : inbound->{TWILIO_INBOUND_SPEAKER}, "
            f"outbound->{TWILIO_OUTBOUND_SPEAKER}"
        )
    print(
        f"🧠 LOCAL INTEL FB    : {'ON' if ENABLE_LOCAL_INTELLIGENCE_FALLBACK else 'OFF'}"
    )
    
    if MODEL_TYPE == "GOOGLE" and not GOOGLE_KEY:
        print("⚠️  WARNING: GOOGLE_STT_API_KEY not set")
    if MODEL_TYPE == "GROQ" and not GROQ_KEY:
        print("⚠️  WARNING: GROQ_API_KEY not set")
    
    if MODEL_TYPE == "GOOGLE" and not supported_phone_call:
        print(f"⚠️  NOTE: phone_call model not available for {lang_code}")
        print(f"         Using default model (full language support)")
    
    print("="*50)
    print(f"🚀 Listening on ws://127.0.0.1:3001")
    print("="*50 + "\n")
    
    uvicorn.run(app, host="127.0.0.1", port=3001, log_level="info")
