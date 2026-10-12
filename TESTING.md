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
