# Traceable releases

Source of truth: https://github.com/gopalakrishnachennu/CHENN

## Source versus production

A push saves source and runs checks; it does NOT publish the website. Gmail deployment remains paused. Earlier releases cannot be retroactively tied to a trustworthy Git commit; retain the local historical archives and Firebase release history as legacy evidence.

## Every new Firebase release

1. Commit and push the exact source. Review the **Release checks** result in GitHub Actions.
2. Test authenticated admin/candidate workflows against this exact revision. Record the acceptance evidence in the PR or issue. Do not approve live QA based only on automated tests.
3. Run **Deploy Firebase** manually for the intended branch/tag and confirm live acceptance. The workflow uses the selected immutable commit and serializes production releases.
4. The workflow creates a GitHub deployment record, authenticates Firebase, reruns all checks, embeds `release.json`, and deploys hosting plus Firestore/Storage rules. It does not deploy Auth provider changes or the Gmail Worker.
5. Deployment notes include commit, workflow run and deployment ID. A live fetch must match the expected commit and deployment ID. Failure after deployment is reported as failure/needs inspection, not falsely as success.
6. GitHub deployment history links to the run and records success/failure. The run's `deployment-*` artifact contains timestamps, previous release, test status and lockfile checksum (90-day retention). Preserve artifacts externally if longer audit retention is required. Cancellation may leave a record in progress; check the run and Firebase before retrying.

`https://chenn.web.app/release.json` identifies the published source after the first tracked deployment. The previous production version has no such metadata yet.

## One-time account setup (not yet completed)

- Configure the GitHub `production` environment with required reviewers and deployment branch restrictions where the repository plan supports them.
- Add a least-privilege Firebase deployment service account as the environment secret `FIREBASE_SERVICE_ACCOUNT`, or replace the authentication step with Google Workload Identity Federation. Do not commit or paste credentials. No credential was created by this change.
- Protect `main`: require pull requests and the `Release checks / checks` job; disallow force-push/deletion. Existing repository owners can bypass local scripts or modify workflows unless account-level controls prevent it.
- Review who can dispatch production workflows. A checkbox records an attestation; it is not a substitute for an independently enforced reviewer policy.

Until these steps and live acceptance are complete, do not dispatch production deployment.

## Rollback

Use the previous successful deployment's commit from its record. Create a branch/tag pointing to that verified commit without rewriting `main`, then dispatch the same deployment workflow for that ref. This produces a NEW deployment record tracing the rollback. A revision predating this workflow requires the Firebase console release-history rollback path; manually record that event in a GitHub issue with Firebase release ID, operator, reason and affected version.

Hosting rollback does not restore Firestore documents, Storage objects, rules, authentication configuration or database migrations. Review compatibility and recovery separately. Do not automatically reverse data changes. Partial failures can leave hosting and rules at different versions; inspect Firebase before retrying.

## Remaining feature work

See `GMAIL-MATCHING-STATUS.md`: live OAuth tests, a free Gmail alternative decision, authenticated end-to-end UI checks, job-board connectors and automatic application/timeline integration remain open. This release-process work does not mark those features complete.
