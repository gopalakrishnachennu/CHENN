# Shared JD profiles

Admin input requires title, company, location, HTTP(S) job URL, salary wording, and complete JD. Salary is stored as posted, including currency and period. Use “Not disclosed” only when the posting omits salary. Optional annual salary maximum remains separate for eligibility comparisons; hourly pay is not guessed into an annual amount.

## Flow

Analyze/review → cached JD profile → shared catalog job → candidate-specific matching → approved match → grounded resume.

`jdProfiles/{sha256}` stores the analysis version, creation time, engine, structured profile, reusable requirements and intelligence. The SHA-256 includes normalized title, JD, company, approved family, analysis version and bundled family knowledge. Candidate identity never participates in the cache key. Source edits or knowledge changes invalidate the reference; prior cache records remain available for traceability. Catalog records embed the profile so authorized candidates do not need access to the global cache.

Only admins can read or write the global cache. Transactions deduplicate concurrent requests. Existing jobs receive a profile on matching refresh or resume generation. UI analysis results are invalidated when the source text changes. Every generated resume snapshots `jdHash` and `analysisVersion` alongside its existing input hash and prompt version.

## LLM analysis and resume writing

The Admin Settings OpenAI key and selected model now power two separate structured-output requests. Analyze JD uses an LLM when the key is connected; otherwise intake can still show explicitly labeled rule-based suggestions. Generate requires the key and never silently substitutes a rule-based resume after an API error.

`aiRequests/jd_{hash}` caches LLM profiles keyed by source hash, model and analysis-prompt version. `aiRequests/resume_{hash}` caches completed resume IDs keyed by relevant candidate/job inputs, model, template and writing prompt. A transactional reservation prevents simultaneous paid calls for the same operation. API calls run outside retryable transactions. Failures are reported without automatic paid retries; a later explicit click can retry. Requests abandoned for over five minutes can be retried, so provider-side completion after a network failure can still incur usage. This is deduplication, not a guarantee of exactly-once delivery to an external provider.

Dashboard reads and recalculations never initiate paid analysis. Generate analyzes the job only if its current model/version profile is missing, then passes only that profile and verified candidate evidence to the writer. No original JD is included in the resume-writing input. Resume counters avoid concurrent generation version collisions. Completed records include model, prompt/profile hashes, input/output token counts, response ID and the review checklist. Repeated unchanged input reuses the existing version.

The writer produces up to five summary lines, dynamic skill categories (target 6–8 groups of 4–6 skills), and 9/8 recent/previous employer bullets when enough distinct evidence exists. Sparse source records reduce those counts. Word-count deviations are shown as review warnings, not filled with invented material. Preview, PDF and DOCX support grouped skills, separate summary lines and selective keyword bolding. Official employer/title/date, education, projects and held certifications come from candidate records, not model-generated identity fields.

Admins can confirm held JD qualifications from Match review or the Resume workspace. Evidence/confirmation notes are required; certifications also require their issuer. Skills apply to an employer only when the admin explicitly selects that employer. Confirmations preserve actor/time provenance. Candidate access remains read-only.

Local validators reject unknown evidence references, wrong-employer references, unconfirmed known JD qualifications, unsupported numeric metrics, duplicate responsibilities, unverified categorized skills and altered fixed facts. These checks do not prove semantic entailment: AI paraphrasing must still be checked by an administrator. Approval requires a factual-review confirmation; source changes after generation require regeneration. Drafts are not candidate-visible. The ATS/recruiter-safety numeric fields are not third-party ATS assessments.

OpenAI requests use `store:false`, bounded input/output sizes and a timeout. No key is written into source, Firestore or logs. The existing GUI connection remains browser-local (not a server-side vault); use it only on a trusted administrator device. API use is not free. No paid smoke call or large batch is run automatically by the release checks.

API contract reference: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Verification

`npm run release:check` covers unit tests, Firestore/Storage emulator access tests, TypeScript, production build, and UI/action contracts. API tests mock provider responses; they exercise the actual request serialization and output validators but do not prove that the administrator's live key/model has access. Tests also cover cache reservations/reuse, failure retries, qualification confirmation, approval gating and private request-ledger access.
