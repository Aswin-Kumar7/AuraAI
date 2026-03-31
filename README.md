<h1 align="center">Aura AI</h1>
<p align="center">
  <b>Real-Time Cognitive Copilot for Call Center Agents</b>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/Python-FastAPI-009688?logo=python" />
  <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase" />
  <img src="https://img.shields.io/badge/Twilio-Voice-F22F46?logo=twilio" />
  <img src="https://img.shields.io/badge/Groq-Whisper%20%26%20LLaMA-5436DA" />
  <img src="https://img.shields.io/badge/Pinecone-RAG-00B388?logo=pinecone" />
</p>

---

## 🧠 What is Aura?

**Aura AI** is an enterprise-grade, real-time AI copilot that listens to live phone calls and augments call center agents with:

- **Live Transcription** — Dual-track (agent + customer) speech-to-text using Groq Whisper or Google STT
- **Sentiment Analysis** — Real-time mood tracking with visual sentiment arc graphs
- **Smart Suggestions** — AI-generated response recommendations powered by LLaMA 3.3 70B
- **Knowledge Retrieval (RAG)** — Instant policy/FAQ lookups from a Pinecone vector store
- **Compliance Monitoring** — Automatic alerts when calls hit sensitive keywords
- **Caller Memory** — Persistent context across repeat callers
- **Call Finalization** — Auto-generated summaries, categorization, and audit trails

Built for **telecom, insurance, banking**, and any high-volume call center operation.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AURA AI SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    Twilio Media     ┌──────────────────────┐  │
│  │   Twilio      │───── Stream ──────▶│  Python STT Server   │  │
│  │  Voice SDK    │    (WebSocket)      │  (FastAPI :3001)     │  │
│  │              │                     │  ├─ Groq Whisper     │  │
│  │  Inbound /   │                     │  ├─ Google STT       │  │
│  │  Outbound    │                     │  └─ Silence Filter   │  │
│  └──────┬───────┘                     └──────────┬───────────┘  │
│         │                                        │              │
│         │  TwiML                     Transcripts  │              │
│         ▼                                        ▼              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js 16 App (TypeScript)                  │   │
│  │  ┌────────────────┐  ┌─────────────────────────────────┐ │   │
│  │  │  Agent Portal   │  │       API Routes                │ │   │
│  │  │  ├ Dashboard    │  │  /api/twilio/*    Voice hooks   │ │   │
│  │  │  ├ Live Call    │  │  /api/transcription/hybrid      │ │   │
│  │  │  ├ Calls History│  │  /api/ai/*        LLM analysis  │ │   │
│  │  │  ├ Insights     │  │  /api/company/*   Admin APIs    │ │   │
│  │  │  ├ Phonebook    │  │  /api/kb/*        Knowledge     │ │   │
│  │  │  └ Profile      │  │  /api/auth/*      Firebase Auth │ │   │
│  │  ├────────────────┤  └─────────────────────────────────┘ │   │
│  │  │  Admin Portal   │                                      │   │
│  │  │  ├ Dashboard    │  ┌─────────────────────────────────┐ │   │
│  │  │  ├ Agents Mgmt  │  │       Data Layer                │ │   │
│  │  │  ├ Analytics    │  │  Firebase Firestore (real-time) │ │   │
│  │  │  ├ Compliance   │  │  Pinecone (vector embeddings)   │ │   │
│  │  │  └ KB Setup     │  │  Groq LLaMA 3.3 (intelligence)  │ │   │
│  │  └────────────────┘  └─────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🎙️ **Dual-Track Transcription** | Separate agent & customer audio streams via Twilio Media Streams |
| 🧠 **Hybrid Intelligence** | Routes transcription through a hybrid endpoint for optimal latency |
| 📊 **Sentiment Arc** | Visual sentiment timeline using LLaMA-powered analysis |
| 💡 **Response Suggestions** | Context-aware reply recommendations during live calls |
| 📚 **RAG Knowledge Base** | Pinecone-backed retrieval for instant policy lookups |
| 🔒 **Compliance Alerts** | Real-time flagging of sensitive keywords & phrases |
| 🧠 **Caller Memory** | Cross-call context persistence for repeat callers |
| 📞 **Outbound Dialer** | Browser-based calling with Twilio Voice SDK |
| 🏢 **Multi-Tenant** | Company-level configuration, agent whitelisting, role-based access |
| 📋 **Audit Trail** | Full call audit logs with compliance tracking |
| 📈 **Analytics Dashboard** | Company-wide performance, sentiment, and call volume insights |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TailwindCSS, Framer Motion, Three.js |
| **Backend API** | Next.js API Routes (TypeScript) |
| **STT Server** | Python, FastAPI, WebSocket |
| **Speech-to-Text** | Groq Whisper (primary), Google STT (fallback) |
| **LLM** | Groq LLaMA 3.3 70B Versatile |
| **Database** | Firebase Firestore (real-time sync) |
| **Auth** | Firebase Auth (Google Sign-In) + Session Cookies |
| **Telephony** | Twilio Programmable Voice + Media Streams |
| **Vector Store** | Pinecone |
| **Voice Preview** | Deepgram TTS |
| **State Management** | Zustand |
| **UI Components** | Radix UI, Lucide Icons, Chart.js |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.9
- **npm** or **yarn**
- Accounts: [Firebase](https://console.firebase.google.com/), [Twilio](https://www.twilio.com/), [Groq](https://console.groq.com/), [Pinecone](https://www.pinecone.io/)

### 1. Clone & Install

```bash
git clone https://github.com/Aswin-Kumar7/AuraAI.git
cd AuraAI

# Install Node dependencies
npm install

# Set up Python environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install fastapi uvicorn firebase-admin python-dotenv numpy requests websockets
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Fill in all the required API keys in `.env.local`. Refer to `.env.example` for documentation on each variable.

### 3. Run Locally

You need **two terminals** running simultaneously:

**Terminal 1 — Next.js App** (port 3000):
```bash
npm run dev
```

**Terminal 2 — Transcription Server** (port 3001):
```bash
# Activate your virtual environment first
python server/transcription_server.py
```

### 4. Expose for Twilio (Cloudflare Tunnel)

Twilio requires public HTTPS URLs to send webhooks. Use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/) (free, no account needed):

```bash
# Terminal 3 — Expose Next.js
cloudflared tunnel --url http://localhost:3000

# Terminal 4 — Expose WebSocket Server
cloudflared tunnel --url http://localhost:3001
```

Then update your `.env.local`:
```env
NGROK_URL=https://<your-nextjs-tunnel>.trycloudflare.com
WEBSOCKET_TUNNEL_URL=https://<your-ws-tunnel>.trycloudflare.com
```

And configure your **Twilio Phone Number** webhook to point to:
```
https://<your-nextjs-tunnel>.trycloudflare.com/api/twilio/inbound
```

---

## 📁 Project Structure

```
aura-ai/
├── public/                     # Static assets
├── server/
│   └── transcription_server.py # Python FastAPI WebSocket STT server
├── src/
│   ├── app/
│   │   ├── (agent)/            # Agent portal pages
│   │   │   └── agent/
│   │   │       ├── dashboard/  # Live call copilot dashboard
│   │   │       ├── calls/      # Call history
│   │   │       ├── insights/   # Agent performance insights
│   │   │       ├── outbound/   # Outbound dialer
│   │   │       ├── phonebook/  # Contact management
│   │   │       └── profile/    # Agent profile
│   │   ├── (company)/          # Admin/company portal pages
│   │   │   └── company/
│   │   │       ├── dashboard/  # Company overview
│   │   │       ├── agents/     # Agent management & whitelisting
│   │   │       ├── analytics/  # Performance analytics
│   │   │       ├── audit/      # Compliance audit logs
│   │   │       └── setup/      # Company config & knowledge base
│   │   ├── (auth)/             # Authentication pages
│   │   └── api/                # API routes (all server-side)
│   ├── components/             # React components
│   │   ├── agent/              # Agent-specific components
│   │   ├── company/            # Admin-specific components
│   │   └── ui/                 # Shared UI primitives (Radix)
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities, Firebase, Groq, RAG
│   └── store/                  # Zustand state management
├── .env.example                # Environment variable template
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── package.json
└── tsconfig.json
```

---

## 🔐 Security

- All API keys are loaded via environment variables — **no secrets in source code**
- Firebase Admin SDK authenticates server-side operations
- API routes are protected with Firebase Auth token verification
- Role-based access control (Agent vs Admin) enforced in middleware
- Session management via secure httpOnly cookies
- Twilio webhook validation using auth tokens

---

## 📄 License

This project is provided for educational and demonstration purposes.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/Aswin-Kumar7">Aswin Kumar</a>, 
  <a href="https://github.com/NAVEEN78100">Naveen D</a>, 
  Dhasarat Surya, and Kharshavarthan
</p>
