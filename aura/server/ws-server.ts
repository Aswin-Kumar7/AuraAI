import { WebSocketServer, WebSocket } from "ws";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Readable } from "stream";

dotenv.config({ path: ".env.local" });

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT, host: "127.0.0.1" });

console.log(`[Aura AI] Server (GROQ-TRANSCRIPTION) on http://127.0.0.1:${PORT}`);

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || "aura_internal_prod_secret_123";

// Firebase init
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
    });
    console.log("[Firebase] OK");
  } catch (err) {
    console.error("[Firebase] Init Error:", err);
  }
}
const db = getFirestore();

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Audio Utilities (NO XENOVA) ───────────────────────────────────

// Convert Twilio Mu-Law (8kHz) to 16-bit PCM (8kHz)
function mulawToPcm(mulaw: Buffer): Buffer {
  const pcm = Buffer.alloc(mulaw.length * 2);
  for (let i = 0; i < mulaw.length; i++) {
    let u = ~mulaw[i];
    let s = (u & 0x7f) << 3;
    let e = (u & 0x70) >> 4;
    s += 0x84;
    s <<= e;
    s -= 0x84;
    const sample = u & 0x80 ? -s : s;
    pcm.writeInt16LE(sample, i * 2);
  }
  return pcm;
}

// Write a valid WAV header for Groq to parse correctly
function getWavHeader(dataLength: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(8000, 24); // 8kHz
  header.writeUInt32LE(16000, 28); // 8k * 2 (16-bit)
  header.writeUInt16LE(2, 32); // Block align
  header.writeUInt16LE(16, 34); // 16-bit
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

// ── WebSocket Handler ───────────────────────────────────────────

wss.on("connection", (ws: WebSocket) => {
  console.log("[WS] Twilio Link Active");

  let callSid: string | null = null;
  let audioBuffer: Buffer[] = [];
  let bufferSize = 0;
  
  // 3-4 seconds per transcription for optimal latency vs accuracy
  const CHUNK_SIZE_THRESHOLD = 8000 * 2 * 4; 

  async function processBuffer() {
    if (!callSid || bufferSize < 1600) return;

    try {
      const data = Buffer.concat(audioBuffer);
      audioBuffer = [];
      bufferSize = 0;

      // Construct file-like object for Groq
      const wavFile = Buffer.concat([getWavHeader(data.length), data]);
      
      const transcription = await groq.audio.transcriptions.create({
        file: await Groq.toFile(wavFile, `${callSid}.wav`, { type: 'audio/wav' }),
        model: "whisper-large-v3", // State of the art, Indian accent ready
        language: "en",
        prompt: "A phone call between a customer and support agent. Indian-accented English.",
      });

      const text = transcription.text.trim();
      
      // Filter hallucinations (Xenova had these, Groq is much cleaner)
      const isHallucination = !text || text.length < 3 || /\[.*?\]|\(.*?\)/.test(text);

      if (text && !isHallucination) {
        console.log(`[CUSTOMER] ${text}`);

        const newLine = {
          speaker: "customer",
          text,
          timestamp: new Date().toISOString(),
        };

        // Update Firestore
        await db.collection("liveCallState").doc(callSid).update({
          transcript: FieldValue.arrayUnion(newLine),
        }).catch(() => {});

        // Trace for Analysis
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        fetch(`${baseUrl}/api/ai/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_API_SECRET },
          body: JSON.stringify({ callId: callSid, newLine }),
        }).catch(() => {});
      }
    } catch (err) {
      console.error("[Transcription error]:", err);
    }
  }

  ws.on("message", (message: string) => {
    try {
      const msg = JSON.parse(message);
      switch (msg.event) {
        case "start":
          callSid = msg.start.callSid;
          console.log(`[Session] START: ${callSid}`);
          break;
        case "media":
          if (callSid) {
            const raw = Buffer.from(msg.media.payload, "base64");
            const pcm = mulawToPcm(raw);
            audioBuffer.push(pcm);
            bufferSize += pcm.length;

            if (bufferSize >= CHUNK_SIZE_THRESHOLD) {
              processBuffer();
            }
          }
          break;
        case "stop":
          console.log(`[Session] END: ${callSid}`);
          processBuffer();
          break;
      }
    } catch (e) {
      console.error("[WS error]:", e);
    }
  });

  ws.on("close", () => console.log("[WS] Disconnected"));
});
