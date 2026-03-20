# Hybrid Transcription System (v2.13)

## Overview

The hybrid transcription system intelligently routes transcription requests between **browser Web Speech API** (fast, 100-300ms) and **backend Groq Whisper** (reliable, 200-500ms) to optimize for both speed and accuracy.

```
┌─────────────────────────────────────────────────┐
│         HYBRID TRANSCRIPTION ROUTER              │
└─────────────────────────────────────────────────┘
         
         Browser (Agent)              Backend (Customer)
              ↓                              ↓
    ┌─────────────────┐        ┌────────────────────┐
    │ Web Speech API  │        │ Groq Whisper STT   │
    │ (100-300ms)     │        │ (200-500ms)        │
    └────────┬────────┘        └─────────┬──────────┘
             │                           │
             └───────────┬───────────────┘
                         ↓
          /api/transcription/hybrid
                    (Router)
                         ↓
        ┌──────────────────────────────┐
        │ Confidence Filtering          │
        │ Language Validation           │
        │ Duplicate Detection           │
        │ Firestore Storage             │
        │ Intelligence Analysis Trigger │
        └──────────────────────────────┘
```

---

## Architecture

### Components

1. **Frontend Web Speech API** (`useLiveCall.ts`)
   - Captures agent voice via browser
   - Sends to `/api/transcription/hybrid`
   - Source: `browser`
   - Latency: 100-300ms

2. **Backend Groq STT** (`transcription_server.py`)
   - Receives customer audio from Twilio
   - Transcribes via Groq Whisper API
   - Sends to `/api/transcription/hybrid`
   - Source: `backend`
   - Latency: 200-500ms

3. **Hybrid Router** (`/api/transcription/hybrid`)
   - Intelligently routes based on confidence, source, language
   - Validates against Firestore schema
   - Stores results with metadata
   - Triggers intelligence analysis

---

## Data Flow

### Browser → Hybrid → Firestore

```typescript
// 1. Browser Web Speech captures transcript
recognition.onresult = (event) => {
    const transcript = event.results[...][0].transcript;
    const confidence = event.results[...][0].confidence;  // 0-1
    
    // 2. Send to hybrid endpoint
    fetch("/api/transcription/hybrid", {
        method: "POST",
        body: JSON.stringify({
            callId,
            source: "browser",
            transcript,
            confidence,
            language: "en-IN",
            isFinal: true
        })
    });
    
    // 3. Hybrid endpoint decides:
    // - If confidence >= 0.75: Use immediately
    // - If 0.5-0.75: Use with note "verify"
    // - If < 0.5: Queue for backend verification
    // - Write to Firestore with source tag
};
```

### Backend → Hybrid → Firestore

```python
# 1. Python STT generates transcript
text = groq_inference(audio_bytes)  # Via executor in event loop
confidence = 0.85  # Backend default

# 2. Send to hybrid endpoint
send_to_hybrid_endpoint(
    call_sid=call_sid,
    transcript=text,
    confidence=0.85,
    source="backend"
)

# 3. Hybrid endpoint:
# - Validates transcript quality
# - Checks for duplicates
# - Stores with backend source tag
# - Triggers intelligence analysis
```

---

## Confidence Routing Logic

The hybrid router uses confidence scores to make intelligent decisions:

```
Confidence >= 0.75:
├─ HIGH confidence
├─ Use immediately
├─ Source: "browser-direct" or "backend-groq"
└─ Latency shows actual value

Confidence 0.5-0.75:
├─ MEDIUM confidence
├─ Use but mark as "medium"
├─ Queue for backend verification (if browser)
└─ Latency accurate, note added

Confidence < 0.5:
├─ LOW confidence
├─ REJECT (don't store)
├─ Queue for re-capture
└─ Log for debugging
```

---

## API Endpoints

### POST /api/transcription/hybrid

**Request:**
```json
{
  "callId": "CA1234",
  "source": "browser|backend",
  "transcript": "Hello, how can I help?",
  "confidence": 0.85,
  "language": "en-IN",
  "isFinal": true,
  "timestamp": "2026-03-20T10:30:45.123Z"
}
```

**Response:**
```json
{
  "success": true,
  "transcript": "Hello, how can I help?",
  "confidence": 0.85,
  "source": "browser-direct|backend-groq|browser-medium",
  "latency": 145,
  "timestamp": "2026-03-20T10:30:45.123Z",
  "message": "optional note"
}
```

### GET /api/transcription/hybrid?callId=CA1234

Returns hybrid statistics for a call:

```json
{
  "callId": "CA1234",
  "totalTranscriptions": 23,
  "browserTranscriptions": 12,
  "backendTranscriptions": 11,
  "avgBrowserLatency": 183,
  "avgBackendLatency": 342,
  "latestTranscript": { ... },
  "hybridStats": {
    "browserFaster": true,
    "latencySavings": 159
  }
}
```

---

## Configuration

### Environment Variables

```env
# Hybrid endpoint (auto-detect for local development)
HYBRID_ENDPOINT_URL=http://localhost:3000/api/transcription/hybrid

# STT Language
STT_LANGUAGE_CODE=en-IN

# Confidence thresholds (in code, customizable)
BROWSER_HIGH_CONFIDENCE=0.75
BROWSER_MEDIUM_CONFIDENCE=0.50
BACKEND_DEFAULT_CONFIDENCE=0.85
```

### Firestore Document Structure

```javascript
db.collection("liveCallState").doc(callId) = {
  callId: "CA1234",
  viewed: false,
  lastTranscriptAt: "2026-03-20T10:30:45.123Z",
  
  // Array of transcription entries
  transcript: [
    {
      speaker: "agent|customer",
      text: "Hello, how can I help?",
      timestamp: "2026-03-20T10:30:45.123Z",
      confidence: 0.85,
      source: "browser-direct|backend-groq|browser-medium",
      engine: "web-speech|groq",
      latency: 145  // milliseconds
    },
    // ... more entries
  ]
}
```

---

## Monitoring & Stats

### View Hybrid Stats for a Call

```typescript
// In any component
const response = await fetch(
  `/api/transcription/hybrid?callId=${callId}`
);
const stats = await response.json();

console.log(`Browser transcriptions: ${stats.browserTranscriptions}`);
console.log(`Backend transcriptions: ${stats.backendTranscriptions}`);
console.log(`Browser avg latency: ${stats.avgBrowserLatency}ms`);
console.log(`Backend avg latency: ${stats.avgBackendLatency}ms`);
console.log(`Latency saved by hybrid: ${stats.hybridStats.latencySavings}ms`);
```

### Expected Performance

| Metric | Value |
|--------|-------|
| Browser latency | 100-300ms |
| Backend latency | 200-500ms |
| Hybrid decision time | 5-10ms |
| Total to Firestore | 110-315ms (browser) or 205-510ms (backend) |
| Speedup vs Google STT | 60-75% |

---

## Indian Language Support

The hybrid system supports all Indian languages:

```python
SUPPORTED_LANGUAGES = {
    "en-IN": "English (India)",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "ml": "Malayalam",
    "mr": "Marathi",
    "gu": "Gujarati"
}
```

---

## Fallback Handling

If the hybrid endpoint is unavailable:

```
Browser: ✅ Falls back to direct Firestore write
Backend: ✅ Falls back to direct Firestore write + local intelligence pass
```

Both maintain full functionality with degraded stats collection.

---

## Performance Comparison

### Before (Google STT only)
```
Customer speech → Buffer 8KB → Network → Google API → 800-1500ms
Agent speech    → Browser STT → Firestore → 100-300ms
```

### After (Hybrid)
```
Customer speech → Backend STT → Hybrid Router → Firestore → 200-500ms
                                └─ Groq (cheap, fast fallback)
                                
Agent speech    → Browser STT → Hybrid Router → Firestore → 100-300ms
                                └─ Validated, high confidence
```

**Result:** 60-75% faster customer transcriptions, zero impact on agent speed

---

## Development

### Testing Hybrid Endpoint

```bash
# Test browser source
curl -X POST http://localhost:3000/api/transcription/hybrid \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-123",
    "source": "browser",
    "transcript": "Hello world",
    "confidence": 0.9,
    "language": "en-IN",
    "isFinal": true
  }'

# Test backend source
curl -X POST http://localhost:3000/api/transcription/hybrid \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-123",
    "source": "backend",
    "transcript": "Customer response",
    "confidence": 0.85,
    "language": "en-IN",
    "isFinal": true
  }'

# Get stats for a call
curl http://localhost:3000/api/transcription/hybrid?callId=test-123
```

### Monitoring Logs

**Frontend (Browser):**
```
📤 [Hybrid] Routed via: browser-direct (145ms)
```

**Backend (Python):**
```
✅ [HYBRID] Routed via: backend-groq (324ms)
```

**API:**
```
✅ [INTEL] Updated: sentiment=Satisfied
```

---

## Troubleshooting

### Hybrid endpoint returns 400
- Check `callId` is present
- Check `source` is "browser" or "backend"
- Verify `transcript` is not empty

### Hybrid endpoint timeout (5s)
- Next.js server may be down
- FastAPI will fallback to direct Firestore
- Check logs in `/api/transcription/hybrid`

### Browser transcriptions not appearing
- Check microphone permissions
- Check Web Speech API support (Chrome/Edge/Safari)
- Verify confidence >= 0.5

### Backend transcriptions skipped
- Check Groq API key is set
- Check audio is not silence
- Verify language code is correct

---

## Future Enhancements

1. **Parallel Processing**
   - Send to both browser AND backend simultaneously
   - Use whichever responds first
   - Compare accuracy across sources

2. **ML-based Routing**
   - Learn which source is better for which speaker
   - Adjust confidence thresholds dynamically
   - Predict drift in accuracy

3. **Cross-modal Verification**
   - Use browser-captured audio to verify backend results
   - Flag discrepancies for review
   - Improve training data

4. **Regional Dialect Support**
   - Fine-tune models per dialect (Telangana Hindi vs Delhi Hindi)
   - Region-specific confidence calibration

---

## Version History

- **v2.13** - Initial hybrid system with browser + backend routing
- v2.12 - Backend fix for async/blocking I/O
- v2.11 - Pinecone RAG integration
- v2.10 - Groq Whisper fallback
