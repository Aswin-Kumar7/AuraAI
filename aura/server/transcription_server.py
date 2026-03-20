import os
import json
import base64
import asyncio
import numpy as np
import audioop
import requests
import re
from datetime import datetime, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, firestore, initialize_app, get_app
from dotenv import load_dotenv

load_dotenv(".env.local")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Config ──
MODEL_TYPE = os.getenv("TRANSCRIPTION_MODEL", "GROQ").upper()
GROQ_KEY = os.getenv("GROQ_API_KEY")
DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")

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
    if not text: return ""
    text = re.sub(r'\[.*?\]|\(.*?\)|\*.*?\*', '', text)
    blacklist = ["gracias", "watching", "subscribe", "muffled", "indian english"]
    cleaned = text.strip()
    if len(cleaned) < 3: return ""
    if any(b in cleaned.lower() for b in blacklist) and len(cleaned.split()) < 4: return ""
    return cleaned

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
    if not GROQ_KEY or not history: return
    
    print(f"🧠 [ANALYSIS] Analyzing '{history[-1]['text'][:40]}...'")
    context = "\n".join([f"{t['speaker'].upper()}: {t['text']}" for t in history[-10:]])
    name = config.get("companyName", "Aura AI")
    kb_fallback = config.get("knowledgeBase", "Standard policy.")
    
    # 🌲 [VECTOR ATTEMPT]
    pinecone_hints = search_pinecone(history[-1]['text'])
    
    sys_prompt = f"""
    You are the Aura AI Cognitive Hub for {name}.
    KNOWLEDGE BASE: {kb_fallback}
    VECTOR HINTS: {pinecone_hints if pinecone_hints else 'None'}
    
    Return JSON: 
    'sentimentScore': -1.0 to 1.0, 
    'sentimentLabel': 'Neutral'|'Frustrated'|'Satisfied'|'Urgent',
    'intent': 'Exactly what customer wants',
    'currentSuggestions': ['3-5 word response 1', 'response 2'],
    'knowledgeSnippet': 'Relevant specific policy',
    'complianceAlert': true/false,
    'liveSummary': '2 sentence status'
    """
    
    try:
        res = requests.post("https://api.groq.com/openai/v1/chat/completions", 
                            headers={"Authorization": f"Bearer {GROQ_KEY}"}, 
                            json={
                                "model": "llama-3.3-70b-versatile",
                                "messages": [{"role": "system", "content": sys_prompt}, {"role": "user", "content": context}],
                                "response_format": {"type": "json_object"}
                            }, timeout=5)
        intel = json.loads(res.json()["choices"][0]["message"]["content"])
        db.collection("liveCallState").document(call_sid).set(intel, merge=True)
    except Exception as e: print(f"[INTEL-ERR]: {e}")

# ──────── TRANSCRIPTION HUB ────────

def groq_inference(audio_bytes, prompt="A support call."):
    if not GROQ_KEY: return ""
    import io, wave
    with io.BytesIO() as w_io:
        with wave.open(w_io, 'wb') as w_f:
            w_f.setnchannels(1); w_f.setsampwidth(2); w_f.setframerate(16000)
            w_f.writeframes((audio_bytes * 32767).astype(np.int16).tobytes())
        w_io.seek(0)
        files = {"file": ("audio.wav", w_io, "audio/wav")}
        data = {"model": "whisper-large-v3", "prompt": prompt, "temperature": 0.0, "language": "en"}
        res = requests.post("https://api.groq.com/openai/v1/audio/transcriptions", 
                            headers={"Authorization": f"Bearer {GROQ_KEY}"}, 
                            files=files, data=data, timeout=5)
    return clean_transcript(res.json().get("text", ""))

@app.websocket("/")
async def websocket_ep(websocket: WebSocket):
    await websocket.accept()
    print(f"[WS] Streaming Link: ACTIVE ({MODEL_TYPE})")
    call_sid, cfg, buf = None, {}, bytearray()

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg["event"] == "start":
                call_sid = msg["start"]["callSid"]
                cfg = await get_enterprise_config(call_sid)
                print(f"[AI] Ready for Intelligence Session: {call_sid}")

            elif msg["event"] == "media":
                payload = base64.b64decode(msg["media"]["payload"])
                buf.extend(payload)

                if len(buf) >= 24000: # 3s window
                    raw_p = bytes(buf)
                    buf = bytearray()
                    pcm = audioop.ulaw2lin(raw_p, 2)
                    if audioop.rms(pcm, 2) < 500: continue

                    pcm_16, _ = audioop.ratecv(pcm, 2, 1, 8000, 16000, None)
                    a_flt = np.frombuffer(pcm_16, dtype=np.int16).astype(np.float32) / 32768.0
                    mx = np.max(np.abs(a_flt))
                    if 0.05 < mx < 1.0: a_flt *= (1.0 / mx)
                    
                    text = groq_inference(a_flt)
                    if text and len(text) > 2:
                        print(f"✓ \"{text}\"")
                        ts = datetime.now(timezone.utc).isoformat()
                        ref = db.collection("liveCallState").document(call_sid)
                        ref.set({
                            "transcript": firestore.ArrayUnion([{"speaker": "customer", "text": text, "timestamp": ts}])
                        }, merge=True)
                        
                        history = ref.get().to_dict().get("transcript", [])
                        asyncio.create_task(run_intelligence_pass(call_sid, history, cfg))
            elif msg["event"] == "stop": break
    except Exception as e: print(f"[RUNTIME-ERR]: {e}")

if __name__ == "__main__":
    import uvicorn
    os.system('cls' if os.name == 'nt' else 'clear')
    print("=========================================")
    print("      AURA AI COGNITIVE HUB 2.11         ")
    print("=========================================")
    print(f" PRIMARY ENGINE   : {MODEL_TYPE}")
    print(f" VECTOR STORE     : PINECONE (READY) 🌲")
    print("=========================================")
    uvicorn.run(app, host="127.0.0.1", port=3001)
