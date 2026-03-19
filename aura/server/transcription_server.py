import os
import json
import base64
import asyncio
import numpy as np
import audioop
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from firebase_admin import credentials, firestore, initialize_app, get_app
from dotenv import load_dotenv

load_dotenv(".env.local")

app = FastAPI()

# ── Allow All Origins ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Firebase ──
try:
    firebase_app = get_app()
except ValueError:
    private_key = os.getenv("FIREBASE_ADMIN_PRIVATE_KEY")
    if not private_key: raise ValueError("FIREBASE_ADMIN_PRIVATE_KEY is missing")
    cred_dict = {
        "type": "service_account",
        "project_id": os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
        "client_email": os.getenv("FIREBASE_ADMIN_CLIENT_EMAIL"),
        "private_key": private_key.replace("\\n", "\n"),
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    firebase_app = initialize_app(credentials.Certificate(cred_dict))

db = firestore.client()

# ── Faster-Whisper (Distil-Medium) ──
# Distil models are 3x faster on CPU than the original Medium model.
print("[AI] Loading Distil-Whisper Medium (High-Speed Accurate Model)...")
model = WhisperModel("distil-medium.en", device="cpu", compute_type="int8")
print("[AI] Whisper Medium (Distil): ONLINE on PORT 3001 ✓")

def process_audio_chunk(raw_ulaw):
    # 1. Decode Mu-Law to PCM
    pcm_linear = audioop.ulaw2lin(raw_ulaw, 2)
    # 2. Resample 8k -> 16k
    pcm_16k, _ = audioop.ratecv(pcm_linear, 2, 1, 8000, 16000, None)
    # 3. Convert to Float32
    audio = np.frombuffer(pcm_16k, dtype=np.int16).astype(np.float32) / 32768.0
    
    # 4. Normalize (Boost quiet speech)
    max_abs = np.max(np.abs(audio))
    if 0.001 < max_abs < 0.9:
        audio = audio * (0.9 / max_abs)
    
    return audio

@app.websocket("/")
async def websocket_root(websocket: WebSocket):
    await websocket.accept()
    print("[WS] Telephony Stream CONNECTED")
    
    call_sid = None
    audio_data = bytearray()
    
    try:
        while True:
            message = await websocket.receive_text()
            msg = json.loads(message)

            if msg["event"] == "start":
                call_sid = msg["start"]["callSid"]
                print(f"[Session] START: {call_sid}")
            elif msg["event"] == "media":
                if call_sid:
                    payload = base64.b64decode(msg["media"]["payload"])
                    audio_data.extend(payload)
                    
                    # Log a dot every 4000 samples (0.5s) to confirm data arrival
                    if len(payload) > 0:
                        print(".", end="", flush=True)

                    # Process every 2.5 seconds (20000 samples of 8kHz mu-law)
                    if len(audio_data) >= 20000:
                        raw_bytes = bytes(audio_data)
                        audio_data = bytearray()
                        print("\n[AI] Thinking...", end="", flush=True)
                        
                        audio_float = process_audio_chunk(raw_bytes)

                        # Inference: beam_size=1 (greedy) is MUCH faster and usually better for phone lines
                        segments, info = model.transcribe(
                            audio_float, 
                            beam_size=1, 
                            language="en",
                            initial_prompt="A call between a customer and an agent. Indian English."
                        )

                        found_text = False
                        for segment in segments:
                            text = segment.text.strip()
                            if text and len(text) > 4:
                                # Quick filter for hallucinations
                                if "[" in text or "(" in text or ".." in text: continue
                                
                                print(f"\r✓ \"{text}\"")
                                found_text = True
                                
                                live_ref = db.collection("liveCallState").doc(call_sid)
                                live_ref.update({
                                    "transcript": firestore.ArrayUnion([{
                                        "speaker": "customer",
                                        "text": text,
                                        "timestamp": firestore.SERVER_TIMESTAMP
                                    }])
                                })
                        
                        if not found_text:
                            print("\r[AI] (Noise/Silence Filtered)")

            elif msg["event"] == "stop":
                print(f"\n[Session] END: {call_sid}")
                break
    except WebSocketDisconnect:
        print("\n[WS] Disconnected")
    except Exception as e:
        print(f"\n[WS ERROR]: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3001)
