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

## Source extraction and empty-source guard — October 22, 2026

Backend suite: **188 assertions passed** (model 18, HTTP/worker 71, classroom 26, grading 12, queue 13, migration 6, provider fallback 9, objective grading 16, source 17). Backend and frontend production builds pass.

- Replaced TXT FileReader handling with awaited ArrayBuffer decoding, supporting UTF-8 and BOM-marked UTF-16. Invalid encodings and failed reads show a blocking error. The exact 656-character Grade 8 fixture was uploaded in the browser: all 656 characters and the full editable preview appeared.
- Empty, missing, whitespace-only, punctuation-only and oversized sources are blocked before an assignment or generation job is created. Regeneration and the worker also reject source-free legacy assignments. The browser disables generation during reading and when notes are invalid; clearing notes and removing a source were checked manually.
- PDF extraction now reads all pages within the explicit 100,000-character limit, instead of silently stopping at 20 pages/20,000 characters. This change has not received a new PDF upload browser test.
- Generation no longer assumes Class 10 or a curriculum. Explicit grade mismatches and missing/nonmatching verbatim source excerpts reject a provider result and trigger fallback. Quotes are an audit aid, not semantic proof that a question is correct or supported.
- Removed the obsolete statement that student submissions are unsupported.

Focused real-provider local smoke test: assignment `311b98d7-b8ca-4bfe-8ea0-0f3bbd0a09f9`, four questions / six marks, Grade 8 friction and sound, exactly 656 source characters preserved. Three invalid-source requests returned HTTP 400 with no assignments created. All four questions included exact source excerpts; both MCQs had one correct option. Manual agent review found the answers source-supported, but one two-mark written rubric repeated the same idea, and the easy grip recall question was labelled challenging. This is **not teacher acceptance** or evidence of broad paper/grading quality. Teacher review remains necessary before use.

PDF export polish remains open: exports still use image-based html2pdf, and pagination/searchable text need a separate implementation and rendered-PDF test. Photo uploads, 10 versions, provider rate limits and a physical phone were not tested in this slice. Existing synthetic user test records were preserved.

## Scoped launch fixes after d0ada99 — October 22, 2026

This slice preserves the existing upload/editor and classroom layout. Existing user records were not edited or removed. New synthetic records were used for browser and HTTP tests.

### Actual verification run

- **Full backend suite rerun: 271 assertions passed**, including the earlier regression coverage: model 18, HTTP/worker 82, classroom 26, grading 12, queue 13, migration 6, provider fallback 9, objective/written grading 16, source extraction/guards 17, review/template checks 17, rubric evaluation contracts 55. Provider tests intercept requests; no paid provider calls were made.
- Backend TypeScript and frontend production builds passed. Frontend compilation initially hit sandbox restrictions on binding a compiler port; the permitted rerun passed. This is build/type verification, not a claim that the existing repository lint baseline is clean.
- Section instructions now derive from actual question marks, including old stored `N marks` instructions. Generation rejects template tokens in questions and duplicate normalized marking criteria. PDF export rejects template text or unsupported glyphs rather than silently printing/omitting them.
- Direct **production create API** bypass: eight invalid sources (missing, empty, whitespace, punctuation, null, number, object, oversized) returned HTTP 400 / `INVALID_SOURCE`. The new synthetic account had zero assignments afterward. Production database/job counts were not directly inspected.
- Direct **running local backend regeneration API** bypass: four newly seeded invalid-source assignments returned HTTP 400 / `INVALID_SOURCE`, created zero PostgreSQL jobs and preserved their prior failed status. No production invalid-source record was edited to run this test. Isolated integration tests additionally prove invalid-source workers and regeneration make zero provider calls; valid create/regenerate regression paths still pass.
- Browser at **1280×900 and 390×844**: empty and partial Save all inputs show persistent explanations, red field borders and per-question messages; the first invalid field receives focus. A teacher-entered zero/comment survived bulk suggestions. Complete marks saved, remained after full reload, and could be shared. Empty/partial marks and edits after saving were blocked from sharing. A deliberate local backend outage produced clear failure feedback while retaining form entries; retry after restoration succeeded.
- Browser student check: released 10/10 synthetic result visible; submitted MCQ controls disabled, written fields read-only and no submit button. API classroom tests also cover submission lock, hidden drafts, saved marks and release guards.

### PDFs

Replaced image-based html2pdf exports with jsPDF text documents and embedded DejaVu fonts. Student and teacher documents are built from explicit separate fields; answers/criteria/source excerpts never enter student export. The toolkit edited-paper export also uses the same text exporter; its edit state must be finished before export. The old html2pdf dependency was removed. A build caught that remaining toolkit import during cleanup; it was migrated before the final build.

`npm run test:pdf` in `backend` generates a seven-question / ten-mark Grade 8 fixture through the same export function. `backend/test/check-pdfs.py` (Python with pdfplumber) checks every question/mark, search, extracted text order, no page images, student answer-guide exclusion, bounds and scientific glyphs. Two additional PDF guard assertions cover template tokens and unsupported glyphs.

- Normal student paper: **1 page**, 1,011 selectable characters, zero images.
- Teacher fixture guide: **2 pages**, 3,134 selectable characters, zero images.
- Long-layout stress: 4 pages; Greek alpha/beta and superscript squared present. Oversized blocks flow across pages and all text bounds remain inside margins; a long guide can still have a sparsely filled final page.
- Both actual browser download buttons were exercised. Downloaded student/teacher files were copied to `output/pdf/browser-*.pdf`, rendered with Poppler and visually inspected on every page. Student: one page / 1,011 selectable characters; teacher: two pages / 2,921 selectable characters; zero page images. Search/extraction worked and the student file contained no answer-guide sections. The browser fixture used intentionally seeded synthetic evidence; it is an export test, not a source-grounding evaluation.
- Native Preview verification: searching the student PDF for `friction` found five matches; searching the teacher guide for `Criterion` found matches on page two. Select-all/copy/paste in Preview reproduced the complete selectable text for both PDFs, including both teacher pages.
- Rendered standard fixtures and all stress pages were also inspected. No clipping or overlap found. `output/pdf/` contains PDFs and PNG previews; `output/qa/` contains desktop/mobile screenshots and machine-readable results. These generated artifacts are ignored by Git; reproducible tests and the teacher packet are committed.

### Rubrics and cost boundary

Generation instructions require independent question/source-specific criteria, exact allocations, no repeated facts or credit for copying the question, concrete partial-credit steps, consistent model examples and valid alternative wording. Exact duplicate criteria are structurally rejected, but semantic independence and correctness are not proven by that check or a source quote.

Every written score is now explicitly a teacher-review draft, including confidently returned checks. Bulk suggestions exclude unreviewed written drafts and never overwrite teacher-entered marks/comments. Teachers can inspect a draft, enter their own score, save and share; no answer is automatically rejected or a draft released based on an unvalidated rubric.

Inspection confirmed blank answers already bypassed Jev. They now report `local-blank` / `Local no-answer check`, zero marks and a clear statement that no provider was called. Mocked tests exercise blank/no-call behavior, correct/partial/wrong/alternative answers, rate-limit responses, malformed/incomplete results and network failures. The existing weighted multi-mark contract test verifies explicit half-credit arithmetic. Failures keep submissions available for teacher review.

`output/qa/rubric-samples.json` records **15 samples across three two-mark questions**: developer/AI expected marks, suggested marks and reasons. All expected/suggested values agree because provider decisions are mocked to exercise the contract. **This is not a live-model accuracy result or teacher approval.** See `TEACHER_PILOT.md` for independent teacher review instructions and sample criteria.

### Remaining gaps

No live Jev grading or new live AI paper-quality evaluation was run: no paid budget/spend cap is approved. Current prompt/rubric changes need independent real-teacher assessment and a representative pilot before any launch-ready accuracy claim. Source quotations remain audit evidence, never proof of correctness. The toolkit edited-paper path uses the shared exporter and passed the build, but its separate edit/download UI was not browser-tested. Actual uploaded-source/browser extraction was not repeated in this slice; the 17 source regression checks were rerun and its UI flow was left intact. Photo uploads, ten paper versions, rate-limit/load testing and a physical phone remain untested. PDF fixtures cover English and selected scientific symbols; unembedded scripts/glyphs block export, and diagrams/rich mathematical typesetting remain outside the text-export coverage.
