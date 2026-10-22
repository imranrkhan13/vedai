# Application verification

Verified on October 12, 2026 against the isolated local PostgreSQL database and Redis database 15, using synthetic teachers, students, syllabuses and answers.

- Backend automated suite: 115 assertions passed (model 18, HTTP/worker 64, classroom 21, grading 12).
- Backend TypeScript build and frontend production build passed.
- Live integration: 63 assertions passed, including real AI question generation and Jev grading, teacher ownership isolation, student login, submission, hidden draft marks, teacher approval and released feedback.
- Live Jev model: `jev-1.13.0`. Complete answers scored 15/15, partial answers 6/15, incorrect answers 0/15. Teacher review shows individual marking points and deductions.
- Browser verified teacher and student login, teacher grading review, released student results and actual text syllabus upload. Uploaded syllabus generated seven questions totaling ten marks.
- Fixed a regression where a temporary generation failure was shown as terminal while BullMQ was still retrying. Tests cover interim and exhausted retry states.
- Browser landing page verified at a narrow viewport with Inter/Helvetica typography.

## Remaining limitations

- The supplied Mistral credential returned HTTP 401. Other configured generation providers remain available.
- Existing frontend lint violations remain; production compilation and TypeScript checks pass.
- Student PDF export showed its success notification, but the browser did not expose the downloaded file for rendered PDF inspection. Teacher guide PDF rendering has not been verified.
- Tests use synthetic records. This is not a verification against real student submissions or a formal assessment of grading accuracy across subjects.

Secrets are stored in ignored server-side configuration and are not included in this report or browser code.

## Production verification

GitHub main commit `8032e38` deployed successfully to https://vedai-coral.vercel.app on October 12, 2026. Vercel build logs confirm the commit and a successful production build. The landing page was verified in the browser.

The public API health check, synthetic teacher registration, and authenticated session lookup pass. Full production integration currently stops at assignment creation: HTTP 500, `Failed to create`. The API still exhibits the older backend release behavior. Production grading is therefore not verified; backend deployment access and logs are required to resolve the failure. The integration runner now sends the same CSRF header as the browser.

## Redis removal and successful production retest

October 12, 2026: replaced Redis caching/pub-sub and BullMQ with a durable PostgreSQL job queue. Removed Redis dependencies, Docker service and server configuration. Render backend now deploys main and uses the PostgreSQL worker. Existing student records, access codes, submitted answers and final marks are preserved by the tested one-time migration; original tables remain intact.

- Automated tests: 136 assertions (including 13 queue assertions, 6 migration assertions, and CSRF/WebSocket ticket isolation).
- Backend production build passes.
- Real local PostgreSQL queue workflow: 63 assertions passed.
- Public production workflow through https://vedai-coral.vercel.app/api: all 63 assertions passed after the Render deployment. Synthetic complete/partial/incorrect answers scored 15/15, 3/15 and 0/15 using Jev model `jev-1.13.0`.
- Production test assignment: `d1191aa2-bae1-48ba-9e8a-2037f223aa21`.

The earlier Redis-quota assignment failure is resolved. Queue tests cover deduplication, claim exclusion, retry delay, persisted attempts/progress, expired lease recovery, stale-worker completion protection, regrading and exhausted retries. Workers renew leases while running; separate workers are visible to the browser through polling.

## Provider reliability update — October 22, 2026

Verified live synthetic requests using the existing primary Groq credential (`openai/gpt-oss-120b`) and Gemini credential (`gemini-3.5-flash-lite`): both returned HTTP 200 and content. The deployed allowlist was found to enable only OpenRouter, preventing the other configured providers from being attempted.

Backend build and all 142 automated assertions pass. Six new provider tests cover primary-key precedence, secondary-key recovery, provider fallback after invalid generated JSON, exhausted-provider diagnostics and allowlist enforcement. The supplied secondary Groq key remains in ignored local/server configuration, not source control. This update concerns question generation; student grading continues to use the separately configured Jev integration.

## Objective and written grading update — October 22, 2026

Backend and frontend production builds pass. Automated tests total 161 assertions, including 16 objective/written grading assertions and three HTTP checks for MCQ submission validation. MCQ grading is deterministic and works without an AI key; invalid choices are rejected before submission is saved. Written grading tests cover explicit multi-mark partial credit and uncertainty flags.

A real local mixed-paper run passed all 63 integration assertions: one MCQ (2 marks), one numerical response (5 marks), and one long answer (8 marks). Complete, partial and incorrect submissions scored 15/15, 3/15 and 0/15. MCQs report `Exact answer check`; written responses used `jev-1.14.0`. The student screen was visually checked with single-choice selection and progress updating from 0/3 to 1/3. Tests demonstrate these cases, not universal grading accuracy; teachers continue to approve final marks.
