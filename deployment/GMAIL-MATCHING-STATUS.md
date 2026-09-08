# Gmail and matching — release status

Updated: 2026-09-08. Saved locally in CHENN. **Not deployed to production.**

## Implemented

- Shared job catalog with manual entry, CSV/JSON import (100 rows per import), validation and duplicate detection.
- Independent candidate–job matches; one JD can support multiple candidate applications without duplicating its content.
- Candidate primary/approved secondary families, target roles, locations, work type, authorization, seniority, experience, salary and score preferences.
- Eligibility checks, evidence-backed skill scoring, explanations, review/reject queues, and admin approval into the existing resume/application workflow.
- Approval transactions recheck current job/candidate requirements and prevent duplicate application records. Recalculation preserves existing review/application history.
- Firebase rules restrict candidates to their own matches and explicitly granted shared JDs. Candidate business-record writes remain denied.
- Gmail consent flow with PKCE, encrypted refresh tokens, selected sender/domain sharing, admin enablement, candidate pause/resume/disconnect, status and minimal message previews.
- Incremental Gmail synchronization, durable leases, idempotency, retries, visible reconnect/history-gap errors, expiry of retained copies, and audit records.
- Tests for matching, imports, transactions, Firebase/Storage access rules, Gmail processing and mocked API boundaries.

## Verification actually completed

`npm run release:check` passed on 2026-09-08:

- 45 unit/SQLite-backed worker tests passed.
- 10 Firestore/Storage emulator integration tests passed.
- TypeScript check passed.
- Firebase frontend production build passed.
- Gmail Worker bundle dry-run passed (this does not deploy or validate credentials).
- 19 existing UI/backend action contracts and default-deny rule checks passed.
- Local preview served successfully and its sign-in page rendered in the browser.

Authenticated UI workflows and real Google consent/synchronization have **not** passed live end-to-end testing. The automated gate is necessary, not proof that every website feature works. The build still reports large frontend chunks.

## Required before release

1. Authenticate the intended Cloudflare account and provision the Gmail service database. Its configuration currently contains an explicit placeholder database ID.
2. Configure a Google OAuth Web application, enable Gmail API, register the exact service callback, and store secrets server-side. See `workers/gmail/README.md`.
3. Set the deployed service URL in Admin → Gmail, enable a consenting test candidate, and complete Google's permission screen as that candidate.
4. Run live checks: approve a match, generate/review/download a resume, refresh/back navigation, independent candidate isolation, reconnect, pause during synchronization, revoke access, disable/archive candidate, and receive a new allowlisted recruiting email. Verify excluded messages are not retained.
5. Confirm the consent/privacy policy, admin access disclosure, deletion procedure, provider quotas and applicable Google verification/security-assessment requirements before onboarding the public.
6. Re-run automated checks on the final source, then deploy the verified version. Do not deploy the unfinished Gmail integration merely because a bundle builds.

## Scope and remaining work

- Job-family classification is supplied by the admin/import; there is no live job-board API connector or automatic classifier in this change.
- Matching is manually recalculated by the admin and after catalog/preference edits, not a durable background queue. Existing legacy candidate-specific jobs are preserved, not automatically migrated.
- Selected matches require admin approval. This change does not submit applications to external job sites.
- Match scoring is deterministic, not a validated prediction of hiring outcomes. Unsupported/unknown requirements require review; generated skills are not accepted as verified candidate evidence.
- Gmail synchronization starts from connection/resume time, not historical mailbox backfill. It reads metadata to filter senders, retains job-related plain-text previews, and does not retain attachments. Heuristic classification can miss messages and is not a guaranteed OTP detector.
- No Gmail sending, OTP automation, automatic application-status changes, or message-to-application timeline linking is implemented here.
- Scheduler processes one due mailbox per minute, with a five-minute per-mailbox target and bounded work per run. More accounts or backlogs increase delay; no fixed-latency guarantee.
- Sharing filters are application-level controls. Google still grants mailbox-wide read scope; selecting senders does not reduce the OAuth scope or remove Google verification requirements.
- No paid tool was installed or purchased. Public server-side Gmail access cannot be promised free of all operating/compliance costs.

## Official references

- [Gmail scopes and restricted-data requirements](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [OAuth token expiration and testing-mode limitations](https://developers.google.com/identity/protocols/oauth2)
