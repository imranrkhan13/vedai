# Ques-AI

A teacher assessment workspace with syllabus uploads, question generation, teacher-assigned student access, typed submissions, and Jev grading drafts with explanations.

## Run locally

Requires Node 20+, PostgreSQL.

1. Run `docker compose up -d` to start PostgreSQL.
2. Install dependencies with `npm ci` in `backend` and `frontend`.
3. Copy `backend/.env.example` to `backend/.env` and configure server credentials. No API keys are included in this repository.
4. Run `npm run build` then `npm start` in `backend` (port 4000).
5. In another backend terminal, run `npm run worker`. Alternatively set `WORKER_IN_WEB=true` to run the worker in the API process.
6. Run `npm run dev` in `frontend`, then open http://localhost:3000.

The frontend proxies `/api` to `http://localhost:4000`. Set `API_PROXY_URL` if the backend is elsewhere. Configure `NEXT_PUBLIC_WS_URL` for a remote WebSocket server.

## Classroom workflow

- Teachers register or sign in, upload a text syllabus/PDF/printed image, and select question types, difficulty and marks. The full extracted text is sent to the question provider, with a 100,000-character limit. PDF and image readers load from jsDelivr in the browser; scanned PDFs require conversion to an image or text first.
- Generation runs in a durable PostgreSQL job queue. Questions have answer keys and weighted marking points; supported generated marking guides can be edited by the teacher.
- Open **Students** from a completed paper. Assign a student ID unique within each paper and give the student the private access code displayed once. IDs currently identify a single paper, the access code selects the paper when an ID is reused.
- Students sign in at `/student`, write typed answers and submit once. Submission is saved before a grading job is queued.
- The worker sends the question, reference answer and typed student answer to TypeSafe's Jev model. It checks each marking point using the Noul API. A probability of at least 0.8 awards that point's weight; at most 0.2 labels it missing; intermediate values withhold credit and flag teacher review. The score is the sum of awarded weights, always bounded by the question's maximum.
- The teacher sees numeric scores, each point's credit/deduction and the explanation of the formula. Explanations are assembled by the app from Jev's checks, not generated prose or private model reasoning. Older papers without marking points use their complete answer key as one point.
- Teachers can use the draft, adjust marks and comments, and save each question. Results stay hidden until every question is marked and the teacher releases results.
- If Jev or the queue is unavailable, submissions stay saved. The teacher sees the failure and can retry or mark manually. Grading jobs use PostgreSQL queue retries; repeated retries while a job is active are deduplicated.
- Resetting an access code invalidates student sessions. Regeneration is blocked once students are assigned, preserving the paper they answered.

## Configuration

`TYPESAFE_API_KEY` enables Jev grading; `TYPESAFE_MODEL` defaults to `jev-latest`. Question generation uses the existing Groq/Gemini/OpenRouter/Mistral/Cohere fallback chain. At least one generation key is needed. Keep keys server-side.

`AUTH_SECRET` should be a long random secret. Teacher and student sessions use signed httpOnly cookies. Teachers only access their own papers and rosters; student responses never include answer keys or unreleased marks. Student login is rate limited.

## Verification

- Backend: `npm run build` and `npm test`.
- Frontend: `npm run build` and `npm run lint`.

Backend tests cover persistence, generation jobs, owner isolation, authentication cookies, student assignment/login, submission validation, duplicate submission protection, grading explanations, invalid/uncertain Jev responses, result release and access-code reset. They use in-memory PostgreSQL (PGlite), queue stubs and simulated AI responses: passing them does not verify live provider quality, queue delivery or production hosting.

The frontend currently has existing lint failures in several older components (untyped `any` and React effect rules). Production compilation and TypeScript checks are separate from lint.

## PostgreSQL queue

Jobs persist in `vedai_jobs`. Workers claim due jobs atomically using `FOR UPDATE SKIP LOCKED`, renew a ten-minute lease, and retry failures up to `QUEUE_ATTEMPTS` (default 3). Expired leases can be reclaimed after a worker restart. Active grading jobs are deduplicated by student row. No Redis service or credential is required. Completed papers are read directly from PostgreSQL. In-process WebSockets provide immediate updates; browser polling reads persisted status when a separate worker runs.

A one-time migration copies existing student access codes, submissions and final marks into `vedai_classroom_students`. Original tables are retained. Existing students can sign in with their original ID and access code.

## Free-tier question generation

Set `AI_PROVIDER_ALLOWLIST=groq,gemini,openrouter` to exclude Mistral and Cohere from automatic generation. Use free-plan accounts for Groq and Gemini; those APIs also support paid accounts, so model selection alone does not enforce free billing. OpenRouter routing continues to reject models without the `:free` suffix.

Groq tries `GROQ_API_KEY` (or the legacy `GROK_API_KEY`) first, and `GROQ_API_KEY_FALLBACK` only when that request fails. Keys from one organization share rate limits. Gemini defaults to `gemini-3.5-flash-lite`. All provider requests have a 45-second timeout. Invalid JSON or papers that fail question/mark validation advance to the next enabled provider. If none succeeds, the assignment records the provider errors instead of a generic failure.
