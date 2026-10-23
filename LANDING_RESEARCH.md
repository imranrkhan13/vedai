# Quesly landing-page research — 23 October 2026

Purpose: understand public complaints around assessment preparation, collecting work, grading workload and trustworthy feedback, then explain the existing product in everyday language. This is a small purposive desk-research sample, not a representative survey, customer validation or proof of Quesly's accuracy/time savings. No messages, reactions, follows or posts were sent. No paid AI services were called.

## Sources and what they support

1. **LinkedIn — Dr Sunita Gandhi, public education post.**
   https://www.linkedin.com/posts/dr-sunita-gandhi_education-activity-7458412898407600128-otfi
   Browser redirected to https://www.linkedin.com/posts/dr-sunita-gandhi_education-share-7458412897191464960-MDLQ/ and displayed the same post. Public text describes grading outside school hours. This supports messaging about the work around teaching, not a promise that Quesly reduces working hours. Browser was signed in: the saved screenshot is cropped to the public post region, excluding the account sidebar and private notification/profile metrics. Capture: `frontend/public/research/linkedin-workload.jpg`. Relative dates differed between web reader and browser; no exact publication date is asserted.

2. **Hacker News — discussion of grading consistency and order.**
   https://news.ycombinator.com/item?id=40097375
   The discussion includes first-person accounts of grading fatigue, question-by-question marking and rubric revisions. It supports showing explicit marking criteria and retaining teacher review; it does not prove our software removes bias. Capture: `frontend/public/research/hacker-news-consistency.jpg`, a cropped top-of-thread excerpt. Original discussion is linked for full context; screenshot is not a testimonial.

3. **Reddit / r/Teachers — concern about mandated AI grading.**
   https://www.reddit.com/r/Teachers/comments/1xab5s3/admin_wants_to_mandate_using_ai_to_grade_essays/
   Public text read through search/web reader describes AI marks missing substantial essay gaps and a teacher wanting to retain direct engagement with student work. The interactive browser subsequently presented a CAPTCHA. It was not solved or bypassed. `output/research/2026-10-23/reddit-access-blocked.jpg` records that limit; no fabricated post screenshot is displayed. Landing page links the discussion and uses a short paraphrase, not a claim the author uses Quesly.

4. **EdSurge — Steven Swanson, educator opinion, 15 June 2026.**
   https://www.edsurge.com/news/i-built-an-ai-grading-tool-then-a-student-thanked-me-for-words-i-didnt-write
   Describes removing automatic return of AI-generated grades/comments and replacing it with teacher review. Supports clearly explaining draft scores, review and release. This is an account of a different tool, not a Quesly result or endorsement. Capture: `frontend/public/research/edsurge-teacher-review.jpg` (headline, attribution and context excerpt).

5. **UCL Institute of Education — primary research summary.**
   https://www.ucl.ac.uk/ioe/news/2020/nov/marking-key-driver-work-stress-among-teachers
   Search-discovered research context on marking and lesson planning as workload-stress drivers. Not used as a numerical product claim or published screenshot on the landing page.

6. **X / Twitter — attempted, no usable first-person post verified.**
   Search queries covered teachers, grading, workload and hours; results did not yield a reliable direct post. The browser's public search at https://x.com/search?q=teachers%20grading%20workload&src=typed_query&f=live remained blank. Capture: `output/research/2026-10-23/x-unavailable.jpg`. No X quote, screenshot of a purported post, endorsement or customer claim was invented. This platform remains a research gap.

Other searches included r/teaching, r/Professors and education press. Promotional competitor posts and AI-generated Grok-share text were excluded from the evidence used on the landing page.

## Landing decisions

- Explain the entire existing teacher/student workflow, including editable extracted notes and empty-source blocking, without changing that workflow.
- Distinguish exact MCQ checks, local blank checks and unvalidated written-answer drafts.
- Explain saved marks, unsaved-change sharing guards and teacher-controlled result release.
- Demonstrate one source-supported two-mark question with two distinct criteria; label all example content as illustrative, not a real submission or accuracy demonstration.
- Show genuine, linked screenshot excerpts directly inside the hero, labelled independent assessment discussions rather than Quesly reviews, as requested in the follow-up. The later research section explains the themes without repeating the screenshots.
- Describe source quotations as references, not proof of correctness. Keep high-stakes/accuracy limits explicit in the FAQ.
- Make no free/unlimited, speed, percentage savings, handwriting grading, photo-submission, compliance or validated-accuracy promise.

## Scope and checks

Only landing-page presentation, its small interactive demonstration, source assets and general page metadata changed. Upload, generation, marking, submission, release and existing records were not modified. The earlier 271 backend checks are historical; they were not rerun for this landing-only slice. Build/browser results for this slice are recorded below after verification.

### Verified on 23 October 2026

- `npm --prefix frontend run build`: passed compilation, TypeScript and all 12 route outputs for the final page.
- `git diff --check`: passed.
- Browser at 1280×1000 and 390×844: no horizontal document overflow; all three public screenshot assets loaded. Images preserve their natural aspect ratios with automatic height, so the entire captured excerpt remains visible, not a cropped thumbnail. Original captures are excerpts, not entire threads or articles.
- Desktop gallery and dedicated problem section visually inspected; mobile problem section visually inspected. Gallery is two columns on desktop (one tall post and two wider excerpts) and a single column on mobile.
- Problem section moved before the detailed workflow, with three problem/response cards and a navigation anchor.
- Notes tab click, ArrowRight to Paper and End to Review: selected state correct. FAQ disclosure opened and its answer was visible. The first automated FAQ selector used a button role which did not match the native summary; the text selector succeeded.
- Start a paper opened the teacher login; Student portal opened the student ID/access-code form. No login or live provider call was made.
- Desktop full-page, desktop hero-post gallery, desktop problem section, mobile full-page and mobile problem screenshots saved under `output/research/2026-10-23/` (local evidence, ignored by Git).
- No backend regression, real-device test, grading-quality evaluation or teacher pilot was rerun for this landing-only update. Research access gaps remain Reddit screenshot/CAPTCHA and X availability as documented above.
