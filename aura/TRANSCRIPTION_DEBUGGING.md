# Transcription Debugging Quick Reference

## Symptom → Diagnosis → Fix

### Customer Speaks But No Transcription Appears

**Diagnosis Steps:**
```bash
# 1. Check Python server is receiving audio
# Look for: "📊 [DEBUG] Packets: X, Buffer: Y bytes"
# If not appearing → WebSocket connection issue

# 2. Check silence detection isn't filtering everything
# Look for: "🔇 [GOOGLE] Silence detected (RMS: X)"
# If every packet is silence → microphone issue on Twilio side

# 3. Check API is actually being called
# Look for: "🎤 [GOOGLE] Processing X bytes (RMS: Y)"
# If not appearing → chunking threshold might be wrong

# 4. Check API responses
# Look for: "❌ [GOOGLE-API-ERR]: 401" or other errors
# 401 = API key invalid
# 403 = Quota exceeded
# 500 = Server error
# 408 = Timeout
```

**Quick Fixes:**
```python
# Increase chunk size to get results faster
CHUNK_LIMIT = 16000  # instead of 8000

# Disable silence detection to debug audio flow
# Comment out RMS checks in websocket_ep()

# Verify API key is actually being loaded
print(f"API Key present: {bool(GOOGLE_KEY)}")
print(f"API Key length: {len(GOOGLE_KEY or '')}")
```

---

### Agent Speech Not Appearing

**Diagnosis Steps:**
```javascript
// 1. Check if Speech Recognition API is available
console.log(
  window.SpeechRecognition || 
  window.webkitSpeechRecognition ? 
  "✅ Available" : "❌ Not available"
);

// 2. Check if microphone permission was granted
// DevTools → Application → Permissions → Microphone → check status

// 3. Check if recognition is being initialized
// Should see: "🎤 [Speech] Recognition started"
// If not → recognition initialization failed

// 4. Check if speech is detected
// Should see: "✅ [Speech] Agent: ..." 
// If not → no speech detected or confidence too low
```

**Quick Fixes:**
```javascript
// Lower confidence threshold for testing
if (confidence < 0.3) {  // was 0.5
  // Accept it anyway
}

// Test microphone separately
const audio = new Audio();
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
// If this fails → browser/OS microphone issue

// Check browser compatibility
// Chrome/Edge: ✅ Full support
// Safari: ❌ No Web Speech API
// Firefox: ⚠️ Limited support
```

---

### High Latency / Delayed Transcription

**Diagnosis:**
```python
# Look for these patterns in logs:
# - "🔄 [GOOGLE] Retrying..." → API is flaky, add more retries
# - "⏱️  [GOOGLE] Request timeout" → increase timeout
# - Multiple packets before threshold → chunk size too large
# - Many "🔇 Silence detected" → audio quality poor
```

**Fixes:**
```python
# 1. Reduce chunk size for faster feedback
CHUNK_LIMIT = 4000  # ~0.5s instead of 1s (but more API calls)

# 2. Increase timeout for slow networks
requests.post(..., timeout=12)  # was 8

# 3. Only send non-silence chunks
if compute_audio_level(raw_p) < 50:  # silence threshold
    continue

# 4. Reduce retries on timeout (if timeout is network issue)
if retry_count < 2:  # instead of 3
    retry
```

---

### Firestore Not Updating / "NOT_FOUND" Error

**Diagnosis:**
```python
# Error: "NOT_FOUND" when updating liveCallState
# Cause: Document doesn't exist when trying to merge

# Check if liveCallState was created:
# Look for: "[WS] Streaming Link: ACTIVE" message
# This should trigger call_sid creation in Firestore
```

**Fixes:**
```python
# The code already uses merge=True, but ensure:
ref.set({
    "viewed": False,
    "transcript": firestore.ArrayUnion([...])
}, merge=True)  # ← This is critical

# If still failing, pre-create doc:
ref.set({"callId": call_sid}, merge=True)  # First
# Then subsequent updates won't fail
```

---

### Google API Quota Exceeded

**Diagnosis:**
```
Error: "400 - Quota exceeded"
```

**Fixes:**
```bash
# 1. Check quota in Google Cloud Console
# Speech-to-Text → Quotas → check daily limit

# 2. Increase quota
# Edit quota → increase limit

# 3. Reduce API calls in code
# Increase CHUNK_LIMIT to 16000+ to batch more
# Improve silence detection to skip quiet chunks
# Add client-side caching for common phrases

# 4. Monitor via Python
import logging
logging.info(f"API calls made today: {api_call_counter}")
```

---

## Server Health Check

```python
# Add this endpoint to transcription_server.py for health monitoring

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "engine": MODEL_TYPE,
        "google_key_loaded": bool(GOOGLE_KEY),
        "groq_key_loaded": bool(GROQ_KEY),
        "firebase_connected": db is not None,
        "uptime_seconds": int(time.time() - start_time),
        "active_connections": len(active_connections),
        "api_calls_made": api_call_counter,
    }

# Test with:
curl http://127.0.0.1:3001/health
```

---

## Performance Profiling

```python
# Add timing to identify bottlenecks

import time

start = time.time()
text = google_inference(raw_p)
elapsed = time.time() - start

logger.info(f"⏱️  Google STT took {elapsed*1000:.0f}ms for {len(raw_p)} bytes")

# Acceptable times:
# - 500-1000ms for 8000 bytes (1s of audio) = Normal
# - >2000ms = Slow network or server issues
# - <300ms = Likely cached response or error
```

---

## WebSocket Connection Issues

```python
# Connection fails/drops frequently
# Symptoms: "[WS] Client disconnected" appears often

# Causes:
1. Network instability → Check connection quality
2. Memory leak in server → Check RAM usage
3. Firestore rate limiting → Increase Firestore quota
4. Python process memory → Check for audio buffer leaks

# Fixes:
# 1. Monitor connections
netstat -an | grep 3001 | wc -l  # Count connections

# 2. Check server memory
top -p $(pgrep -f transcription_server)

# 3. Add connection pooling
# Use asyncio.gather() for multiple operations

# 4. Add cleanup on disconnect
finally:
    logger.info(f"[WS] Cleanup - Call: {call_sid}")
    # Close any open resources
```

---

## Testing Checklist

- [ ] Python server starts without errors
- [ ] Can make test API call to Google Speech-to-Text
- [ ] Websocket accepts connections from Twilio
- [ ] Receives audio data in media events
- [ ] Processes audio chunks without crashes
- [ ] Transcription appears in Firestore
- [ ] Agent microphone captures speech
- [ ] Fallback API works
- [ ] No memory leaks after 1 hour
- [ ] Can handle 5+ concurrent calls
- [ ] Graceful error handling on API failures

---

## Key Files to Monitor

```
Log these for debugging:
- Python console output (transcription_server.py)
- Browser DevTools console
- Firestore → liveCallState collection
- Firebase Cloud Functions logs (if used)
- Network tab (WebSocket handshake)

Critical log messages:
- "[WS] Streaming Link: ACTIVE" = Good
- "❌ [GOOGLE-API-ERR]" = API issue
- "🔇 Silence detected" = Normal (expected often)
- "[RUNTIME-ERR]" = Critical bug
```
