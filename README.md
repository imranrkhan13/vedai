# VedaAI – AI Assessment Creator
### Full Stack Engineering Assignment Submission

---

## 📁 Project Structure

```
vedaai/
├── README.md                          ← You are here
├── docker-compose.yml                 ← Spins up MongoDB + Redis locally
│
├── backend/                           ← Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── index.ts                   ← Entry point: Express server + WebSocket init
│   │   ├── worker.ts                  ← BullMQ worker (run as SEPARATE process)
│   │   │
│   │   ├── models/
│   │   │   └── Assignment.ts          ← Mongoose schema: Assignment, Section, Question
│   │   │
│   │   ├── routes/
│   │   │   ├── assignments.ts         ← REST CRUD: GET/POST/DELETE + /regenerate
│   │   │   └── jobs.ts                ← GET /api/jobs/:jobId → BullMQ job state
│   │   │
│   │   └── services/
│   │       ├── aiGenerator.ts         ← AI fallback chain (Gemini→OpenRouter→Mistral→Cohere→Groq)
│   │       ├── db.ts                  ← MongoDB connection (Mongoose)
│   │       ├── queue.ts               ← BullMQ Queue factory
│   │       ├── redis.ts               ← ioredis singleton
│   │       └── websocket.ts           ← WS server: per-client channels, notifyClient()
│   │
│   ├── .env                           ← ⚠️  Pre-filled with all API keys (ready to run)
│   └── tsconfig.json
│
└── frontend/                          ← Next.js 14 App Router + TypeScript
    ├── app/
    │   ├── layout.tsx                 ← Root layout, Inter font, React Hot Toast
    │   ├── page.tsx                   ← Redirects / → /assignments
    │   ├── assignments/page.tsx       ← Dashboard: card grid, search, status badges
    │   ├── create/page.tsx            ← Multi-step form: validation, file upload, type picker
    │   └── output/[id]/page.tsx       ← Question paper: progress steps, stats, PDF export
    │
    ├── components/
    │   └── layout/Sidebar.tsx         ← Left nav: logo, create button, nav items, user profile
    │
    ├── store/
    │   └── assignmentStore.ts         ← Zustand store: assignments state + WebSocket client
    │
    ├── lib/
    │   └── api.ts                     ← Typed fetch wrapper for all backend endpoints
    │
    └── types/
        └── index.ts                   ← Shared TypeScript interfaces (Assignment, Section, Question…)
```

---

## 🚀 How to Run (5 minutes)

### Step 1 – Start MongoDB + Redis
```bash
docker-compose up -d
```

### Step 2 – Backend API Server
```bash
cd backend
npm install
npm start          # runs ts-node src/index.ts on :5000
```

### Step 3 – Background Worker (new terminal)
```bash
cd backend
npm run worker     # BullMQ worker picks jobs from Redis queue
```

### Step 4 – Frontend
```bash
cd frontend
npm install
npm run dev        # Next.js on :3000
```

Open **http://localhost:3000**

> **No API key needed** — the `.env` is pre-filled with all keys.

---

## ⚙️ How It Works (Request Flow)

```
Teacher fills form
       ↓
POST /api/assignments          → MongoDB doc created (status: pending)
       ↓
BullMQ job enqueued            → jobId returned to frontend
       ↓
Frontend → /output/:id         → subscribes via WebSocket
       ↓
Worker picks job               → status: processing
       ↓
aiGenerator.ts tries providers:
  1. Gemini 1.5 Flash
  2. OpenRouter (Llama 3.1 free)
  3. Mistral small
  4. Cohere command-r-plus
  5. Groq llama-3.1-8b
       ↓
JSON parsed + validated        → stored in MongoDB
       ↓
WebSocket notifies frontend    → status: completed
       ↓
Redis caches result (10 min)   → fast subsequent loads
       ↓
Question paper rendered        ← structured sections, difficulty badges, marks
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/assignments` | All assignments (last 50, no output/file) |
| `POST` | `/api/assignments` | Create assignment + enqueue AI generation |
| `GET` | `/api/assignments/:id` | Single assignment (Redis cached if complete) |
| `POST` | `/api/assignments/:id/regenerate` | Re-run generation job |
| `DELETE` | `/api/assignments/:id` | Delete + invalidate cache |
| `GET` | `/api/jobs/:jobId` | BullMQ job state + progress |
| `WS` | `/ws?clientId=xxx` | Real-time progress events |

### WebSocket Events
```json
{ "type": "connected",     "clientId": "xxx" }
{ "type": "job:progress",  "assignmentId": "...", "progress": 50, "message": "Writing questions..." }
{ "type": "job:completed", "assignmentId": "..." }
{ "type": "job:failed",    "assignmentId": "...", "message": "All AI providers failed" }
```

---

## ✅ Features Implemented

### Core (Required)
- [x] Assignment creation form with full validation
- [x] File upload (PDF/TXT) fed into AI prompt
- [x] Zustand state management + WebSocket
- [x] AI question generation (structured prompt → JSON schema → parse → store)
- [x] Sections (A/B/C), difficulty distribution, marks per question
- [x] MongoDB for assignments + results
- [x] Redis for caching completed assignments
- [x] BullMQ for background jobs
- [x] WebSocket real-time progress updates
- [x] Structured output: sections, questions, difficulty tags, marks

### Bonus (Extra)
- [x] **PDF export** — html2pdf.js (formatted A4, not raw HTML print)
- [x] **Copy to clipboard** — plain-text version of question paper
- [x] **Regenerate button** — re-queues job, invalidates cache
- [x] **Multi-provider AI fallback** — 5 providers, automatic failover
- [x] **Progress step indicator** — 4-stage visual progress track
- [x] **Stats dashboard** — marks/sections/questions/duration tiles
- [x] **Difficulty stats** in paper footer (X Easy, Y Medium, Z Hard)
- [x] **Search + filter** on assignments page
- [x] **Loading skeletons** for better perceived performance
- [x] **Figma-faithful UI** — white sidebar, card grid, orange accent, topbar

---

## 🛠️ Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 14 App Router + TypeScript | SSR, file-based routing, React Server Components |
| State | Zustand | Lightweight, no boilerplate, WebSocket integration easy |
| Backend | Express + TypeScript | Familiar, minimal overhead |
| Database | MongoDB + Mongoose | Flexible schema for nested output |
| Cache | Redis + ioredis | Fast completed-assignment lookups |
| Queue | BullMQ | Built on Redis, retry logic, job state tracking |
| Realtime | ws (WebSocket) | Per-client channels, lightweight |
| AI | Multi-provider fallback | No single point of failure, free tiers |
| PDF | html2pdf.js | Client-side, no server dependency |

