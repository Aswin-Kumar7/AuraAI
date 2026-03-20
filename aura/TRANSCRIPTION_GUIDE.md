# Live Transcription System - Setup & Troubleshooting Guide

## Overview

The live transcription system now has three components:

1. **Python WebSocket Server** (`server/transcription_server.py`) - Receives Twilio audio streams and transcribes via Google Speech-to-Text or Groq
2. **Frontend Agent Speech Capture** (`src/hooks/useLiveCall.ts`) - Captures agent speech via browser Web Speech API
3. **Fallback API** (`src/app/api/calls/transcription/log/route.ts`) - Manual transcription logging

## Prerequisites

### Environment Variables

Add to `.env.local`:

```
# Google Speech-to-Text (Recommended for call centers)
GOOGLE_STT_API_KEY=your-google-api-key

# Groq (Fallback option)
GROQ_API_KEY=your-groq-api-key

# Transcription Engine Selection
TRANSCRIPTION_MODEL=GOOGLE  # or GROQ

# Twilio (existing)
NGROK_URL=https://your-ngrok-url.ngrok.io
WEBSOCKET_TUNNEL_URL=wss://your-tunnel-url
```

### Google Speech-to-Text Setup

1. **Create Google Cloud Project**
   ```bash
   gcloud projects create aura-stt
   gcloud config set project aura-stt
   ```

2. **Enable Speech-to-Text API**
   ```bash
   gcloud services enable speech.googleapis.com
   ```

3. **Create Service Account**
   ```bash
   gcloud iam service-accounts create aura-stt-key
   gcloud projects add-iam-policy-binding aura-stt \
     --member=serviceAccount:aura-stt-key@aura-stt.iam.gserviceaccount.com \
     --role=roles/speech.admin
   ```

4. **Create API Key**
   - Go to Google Cloud Console → Credentials
   - Create API Key (restrict to Speech-to-Text API)
   - Copy the key to `GOOGLE_STT_API_KEY`

### Python Server Setup

```bash
# Install dependencies
pip install fastapi uvicorn firebase-admin python-dotenv numpy requests

# Start server
python server/transcription_server.py
```

Server listens on `ws://127.0.0.1:3001`

## Testing Transcription

### 1. Test Python Server Startup

```bash
python server/transcription_server.py
```

Expected output:
```
==================================================
      AURA AI COGNITIVE HUB 2.12
==================================================
✅ PRIMARY ENGINE    : GOOGLE
🌲 VECTOR STORE      : PINECONE (READY)
🔄 RETRY STRATEGY    : 3 attempts
📊 CHUNK SIZE        : 8000 bytes
==================================================
🚀 Listening on ws://127.0.0.1:3001
==================================================
```

### 2. Test Inbound Call Flow

```bash
# 1. Start Python server
python server/transcription_server.py

# 2. In another terminal, start Next.js dev server
npm run dev

# 3. Make inbound call to Twilio number
# Should see:
# - [WS] Streaming Link: ACTIVE (Engine: GOOGLE)
# - [AI] Ready for Intelligence Session (GOOGLE): callSid
# - ✅ [GOOGLE] "transcript text..."

# 4. Check Firestore → liveCallState/{callSid}
# Should see transcript array populated
```

### 3. Test Agent Speech Capture

```bash
# 1. Make sure browser has microphone permission
# 2. Start a call
# 3. Agent speaks - should see in console:
# - 🎤 [Speech] Recognition started
# - ✅ [Speech] Agent: "agent speech" (confidence: 95.2%)

# 4. Check Firestore transcript for agent entries
```

### 4. Test Fallback API

```bash
curl -X POST http://localhost:3000/api/calls/transcription/log \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "CA12345",
    "speaker": "agent",
    "text": "How can I help you today?",
    "confidence": 0.98,
    "source": "manual"
  }'
```

## Common Issues & Fixes

### Issue: "No transcription appearing"

**Causes:**
- Python server not running
- WebSocket tunnel URL incorrect
- Google API key invalid

**Fixes:**
```bash
# 1. Check Python server is running
ps aux | grep transcription_server.py

# 2. Check Firestore connectivity in Python
# Add debug in transcription_server.py:
print(f"Firebase initialized: {db is not None}")

# 3. Verify Google API key
curl "https://speech.googleapis.com/v1/speech:recognize?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"config":{"encoding":"MULAW","sampleRateHertz":8000},"audio":{"content":""}}'
# Should return a valid JSON response (may be error, but no auth failure)
```

### Issue: "Only getting customer speech, no agent"

**Causes:**
- Browser doesn't support Web Speech API (no microphone access, or Safari)
- Speech recognition initialization failed
- Microphone permission denied

**Fixes:**
```bash
# 1. Check browser console for [Speech] messages
# Should see: "🎤 [Speech] Recognition started"

# 2. Test microphone access
# Go to browser DevTools → Application → Permissions
# Grant Microphone access

# 3. Fallback to manual API
# Add manual agent transcription via API endpoint
```

### Issue: "Python server crashes or high latency"

**Causes:**
- Google API rate limit hit
- Network timeout
- Too many concurrent connections

**Fixes:**
```python
# Already handled in updated code with:
- Retry logic (3 attempts with 0.5s delay)
- Request timeout: 8 seconds
- Silence filtering reduces API calls
- Async processing prevents blocking

# Monitor server:
# - Check logs for [GOOGLE-API-ERR]
# - Look for timeout messages
# - Verify network connectivity
```

### Issue: "Low transcription quality"

**Optimize:**

1. **Audio Preprocessing** (already in place)
   - Silence detection filters short chunks
   - RMS normalization for Groq path
   - Phone call model for Google (optimized for 8kHz)

2. **Engine Selection**
   - Google: Best for Indian accents, call centers
   - Groq: Faster, cheaper, but slightly lower quality

3. **Language Settings** (already optimized)
   - `en-IN` for Indian English
   - `enableAutomaticPunctuation: True`
   - `model: phone_call`

## Monitoring Integration

### Logs to Watch

**Python Server:**
```
✅ [GOOGLE] "transcript" - Good transcription
❌ [GOOGLE-API-ERR] - API failure
🔄 [GOOGLE] Retrying... - Retry in progress
🔇 [GOOGLE] Silence detected - Silence filtering
```

**Frontend:**
```
🎤 [Speech] Recognition started - Agent speech capture began
✅ [Speech] Agent: "..." - Agent speech captured
❌ [Speech] Error - Speech API error
```

**Firestore:**
```
liveCallState/{callSid}:
- transcript[]: Array of speaker/text/timestamp/confidence/source
- lastTranscriptAt: Latest transcript timestamp
- viewed: false (signals UI refresh needed)
```

## Performance Tuning

### Python Server

```python
# Current settings (optimized):
CHUNK_LIMIT = 8000        # 1s for Google (faster feedback)
MAX_RETRIES = 3           # 3 retry attempts
RETRY_DELAY = 0.5         # 500ms between retries
TIMEOUT = 8               # 8 second request timeout

# To improve reliability:
# - Increase CHUNK_LIMIT to 16000 if you want better context
# - Increase MAX_RETRIES to 5 for unreliable networks
# - Increase TIMEOUT to 12 for slow connections
```

### Frontend

```typescript
// Current settings (optimized):
recognition.continuous = true           // Keep running
recognition.interimResults = false       // Only final results
recognition.lang = "en-IN"               // Indian English
recognition.maxAlternatives = 1          // One best result

// Max error threshold: 3 errors before stopping
MAX_RECOGNITION_ERRORS = 3

// To improve:
// - Change lang to "en-US" for American English
// - Increase MAX_RECOGNITION_ERRORS for noisy environments
```

## Deployment Checklist

- [ ] Python server running on production machine
- [ ] WebSocket tunnel configured (Cloudflare/ngrok)
- [ ] Google Speech-to-Text API key set and quota increased
- [ ] Firebase/Firestore credentials set
- [ ] `TRANSCRIPTION_MODEL=GOOGLE` in .env
- [ ] Firestore security rules allow agent writes to `liveCallState`
- [ ] Browser requires microphone permission (add to app header)
- [ ] Test inbound call end-to-end
- [ ] Monitor first 10 calls for issues
- [ ] Enable Python server logging to file for debugging

## API Reference

### Transcription Log Endpoint

**POST** `/api/calls/transcription/log`

Request:
```json
{
  "callId": "CA12345",
  "speaker": "agent|customer",
  "text": "Your message here",
  "timestamp": "2026-03-20T10:30:00Z",  // optional
  "confidence": 0.95,                    // optional (0-1)
  "source": "agent-browser-stt|customer-twilio|manual"  // optional
}
```

Response:
```json
{
  "success": true,
  "callId": "CA12345",
  "speaker": "agent",
  "text": "Your message here",
  "timestamp": "2026-03-20T10:30:00Z",
  "message": "Transcription logged successfully"
}
```

**GET** `/api/calls/transcription/log?callId={callId}`

Response:
```json
{
  "callId": "CA12345",
  "transcript": [
    {
      "speaker": "customer",
      "text": "I have a billing question",
      "timestamp": "2026-03-20T10:30:00Z",
      "confidence": 0.98,
      "engine": "GOOGLE"
    },
    {
      "speaker": "agent",
      "text": "I can help with that",
      "timestamp": "2026-03-20T10:30:05Z",
      "confidence": 0.95,
      "source": "agent-browser-stt"
    }
  ],
  "totalLines": 2,
  "lastUpdated": "2026-03-20T10:30:05Z"
}
```

## Next Steps

1. **RAG Integration**: Implement real Pinecone embedding for KB queries
2. **Multi-language**: Add support for Hindi, Hinglish transcription
3. **Quality Metrics**: Track transcription accuracy, latency, confidence
4. **Fallback Chain**: Add Deepgram as third fallback option
5. **Cost Optimization**: Batch API calls, cache common phrases
