# Shared JD profiles

Admin input requires title, company, location, HTTP(S) job URL, salary wording, and complete JD. Salary is stored as posted, including currency and period. Use “Not disclosed” only when the posting omits salary. Optional annual salary maximum remains separate for eligibility comparisons; hourly pay is not guessed into an annual amount.

## Flow

Analyze/review → cached JD profile → shared catalog job → candidate-specific matching → approved match → grounded resume.

`jdProfiles/{sha256}` stores the analysis version, creation time, engine, structured profile, reusable requirements and intelligence. The SHA-256 includes normalized title, JD, company, approved family, analysis version and bundled family knowledge. Candidate identity never participates in the cache key. Source edits or knowledge changes invalidate the reference; prior cache records remain available for traceability. Catalog records embed the profile so authorized candidates do not need access to the global cache.

Only admins can read or write the global cache. Transactions deduplicate concurrent requests. Existing jobs receive a profile on matching refresh or resume generation. UI analysis results are invalidated when the source text changes. Every generated resume snapshots `jdHash` and `analysisVersion` alongside its existing input hash and prompt version.

## Engine and limitations

JD analysis currently uses the existing deterministic rule-based engine: no paid LLM analysis call occurs. It recognizes the bundled taxonomy, not every possible technology or credential; administrators must review its suggestions. Adjacent family skills remain unverified suggestions, never asserted candidate facts. Admin skill/eligibility corrections remain on the catalog record.

The existing optional OpenAI integration selects verified evidence for the summary. Its input now contains the cached `JD_PROFILE` and candidate evidence, not the original JD. This change does **not** replace it with a full LLM resume writer. Experience uses up to nine recent and eight previous verified bullets, sorted chronologically. Fewer are emitted when evidence is insufficient. Fixed summary line counts, 6–8 formatted skill categories, word-count rewriting, and selective bolding are not yet implemented. Existing evidence validation continues to prohibit invented credentials, metrics or employment claims.

## Verification

`npm run release:check` covers unit tests, Firestore/Storage emulator access tests, TypeScript, production build, and existing action contracts. New tests cover source invalidation, cached/direct matching equivalence, profile isolation from candidate evidence, concurrent cache requests, denied candidate cache access, required URL/salary, hourly salary preservation, and evidence-limited bullet counts.
