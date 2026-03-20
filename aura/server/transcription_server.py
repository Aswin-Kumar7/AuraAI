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
MAX_RETRIES = 3
RETRY_DELAY = 0.5
GROQ_WHISPER_MODEL = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
GROQ_WHISPER_FALLBACK_MODEL = os.getenv("GROQ_WHISPER_FALLBACK_MODEL", "whisper-large-v3")


def _env_float(name, default, min_value, max_value):
    """Parse and clamp float env config safely."""
    try:
        value = float(os.getenv(name, str(default)))
        return max(min_value, min(max_value, value))
    except Exception:
        return default


# Twilio media stream is 8kHz mulaw (roughly 8000 bytes/sec in payload).
STREAM_BYTES_PER_SECOND = 8000
STT_CHUNK_SECONDS_DEFAULT = _env_float("STT_CHUNK_SECONDS", 1.8, 0.5, 4.0)
STT_CHUNK_SECONDS_GOOGLE = _env_float(
    "STT_CHUNK_SECONDS_GOOGLE", STT_CHUNK_SECONDS_DEFAULT, 0.5, 4.0
)
STT_CHUNK_SECONDS_GROQ = _env_float(
    "STT_CHUNK_SECONDS_GROQ", STT_CHUNK_SECONDS_DEFAULT, 0.5, 4.0
)
CHUNK_LIMIT_GOOGLE = int(STREAM_BYTES_PER_SECOND * STT_CHUNK_SECONDS_GOOGLE)
CHUNK_LIMIT_GROQ = int(STREAM_BYTES_PER_SECOND * STT_CHUNK_SECONDS_GROQ)

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
    
    # Check minimum length
    if len(cleaned) < 3:
        return ""
    
    # Check for mostly blacklisted words
    words = cleaned.lower().split()
    if len(words) < 4:
        if any(b in cleaned.lower() for b in blacklist):
            return ""
    
    # Convert to proper capitalization
    cleaned = cleaned[0].upper() + cleaned[1:] if len(cleaned) > 0 else cleaned
    
    return cleaned


def send_to_hybrid_endpoint(call_sid, transcript, confidence=0.8, source="backend"):
    """Send transcription to hybrid endpoint for intelligent routing and storage.

    Returns True on successful routing, False when fallback storage should be used.
    """
    try:
        payload = {
            "callId": call_sid,
            "source": source,
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
        call_ref = db.collection("liveCallState").document(call_sid).get()
        if not call_ref.exists: return {}
        data = call_ref.to_dict() or {}
        agent_id = data.get("agentId")
        u_ref = db.collection("users").document(agent_id).get()
        cid = (u_ref.to_dict() or {}).get("companyId")
        return db.collection("companyConfig").document(cid).get().to_dict() or {}
    except: return {}

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
                    timeout=8
                )
                
                if res.status_code != 200:
                    logger.error(f"❌ [GROQ-INTEL-ERR]: {res.status_code}")
                    return
                
                choice = res.json().get("choices", [{}])[0]
                content = choice.get("message", {}).get("content", "{}")
                intel = json.loads(content)
                
                # Update Firestore with analysis
                db.collection("liveCallState").document(call_sid).set(intel, merge=True)
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

# ──────── TRANSCRIPTION HUB ────────

def groq_inference(audio_bytes, prompt="A support call.", retry_count=0):
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
            data = {
                "model": model_name,
                "prompt": prompt,
                "temperature": 0.0,
                "language": lang_hint,
                "response_format": "verbose_json",
            }

            return requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_KEY}"},
                files=files,
                data=data,
                timeout=8,
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
        
        res = requests.post(url, json=payload, timeout=8)
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
    call_sid, cfg, buf = None, {}, bytearray()
    packet_count = 0
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
                    logger.info(f"[AI] Ready for Intelligence Session ({MODEL_TYPE}): {call_sid}")
                    packet_count = 0
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
                    
                    buf.extend(payload)
                    packet_count += 1
                    
                    # Log packet flow
                    if packet_count % 20 == 0:
                        elapsed = time.time() - last_transcript_time
                        logger.info(f"📊 [DEBUG] Packets: {packet_count}, Buffer: {len(buf)} bytes, Elapsed: {elapsed:.1f}s")

                    # Adaptive chunk sizing based on engine
                    CHUNK_LIMIT = CHUNK_LIMIT_GOOGLE if MODEL_TYPE == "GOOGLE" else CHUNK_LIMIT_GROQ

                    if len(buf) >= CHUNK_LIMIT:
                        raw_p = bytes(buf)
                        buf = bytearray()
                        
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
                                text = await loop.run_in_executor(executor, google_inference, raw_p)
                            else:
                                # Groq needs PCM conversion and normalization
                                try:
                                    pcm = audioop.ulaw2lin(raw_p, 2)
                                    rms_value = audioop.rms(pcm, 2)
                                    if rms_value < 500:
                                        logger.debug(f"🔇 [GROQ] Silence detected (RMS: {rms_value})")
                                        continue

                                    pcm_16, _ = audioop.ratecv(pcm, 2, 1, 8000, 16000, None)
                                    a_flt = np.frombuffer(pcm_16, dtype=np.int16).astype(np.float32) / 32768.0
                                    mx = np.max(np.abs(a_flt))
                                    if 0.05 < mx < 1.0:
                                        a_flt *= (1.0 / mx)
                                    text = await loop.run_in_executor(executor, groq_inference, a_flt)
                                except Exception as e:
                                    logger.error(f"❌ [GROQ-PROCESS-ERR]: {e}")
                                    continue

                            if text:
                                logger.info(f"✅ [{MODEL_TYPE}] \"{text[:50]}...\"" if len(text) > 50 else f"✅ [{MODEL_TYPE}] \"{text}\"")
                                ts = datetime.now(timezone.utc).isoformat()
                                
                                try:
                                    # Try hybrid endpoint first for intelligent routing
                                    hybrid_success = send_to_hybrid_endpoint(
                                        call_sid, 
                                        text, 
                                        confidence=0.85,  # Backend STT typically high confidence
                                        source="backend"
                                    )
                                    
                                    if not hybrid_success:
                                        # Fallback: Direct Firestore write if hybrid endpoint unavailable
                                        logger.info("[HYBRID] Endpoint unavailable, using fallback storage")
                                        ref = db.collection("liveCallState").document(call_sid)
                                        ref.set({
                                            "viewed": False,
                                            "lastTranscriptAt": ts,
                                            "transcript": firestore.ArrayUnion([{
                                                "speaker": "customer",
                                                "text": text,
                                                "timestamp": ts,
                                                "engine": MODEL_TYPE,
                                                "source": "backend-groq"
                                            }])
                                        }, merge=True)
                                    
                                    last_transcript_time = time.time()
                                    
                                    # Trigger intelligence analysis asynchronously
                                    if hybrid_success:
                                        # Let hybrid endpoint handle intelligence pass
                                        # (it can trigger analysis through response)
                                        pass
                                    else:
                                        # Fallback: Trigger intelligence locally
                                        ref = db.collection("liveCallState").document(call_sid)
                                        history = ref.get().to_dict().get("transcript", []) if ref.get().exists else []
                                        if history:
                                            asyncio.create_task(run_intelligence_pass(call_sid, history, cfg))
                                except Exception as e:
                                    logger.error(f"❌ [FIRESTORE-ERR]: {e}")
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
        f"📊 CHUNK SIZE        : "
        f"{CHUNK_LIMIT_GOOGLE if MODEL_TYPE == 'GOOGLE' else CHUNK_LIMIT_GROQ} bytes"
    )
    print(
        f"⏱️  CHUNK WINDOW      : "
        f"{STT_CHUNK_SECONDS_GOOGLE if MODEL_TYPE == 'GOOGLE' else STT_CHUNK_SECONDS_GROQ:.1f}s"
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
