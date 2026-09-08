# ResumeOS

JD-first resume operations platform with two access levels:

- **Admin:** full control of candidates, jobs, resumes, generation, applications, settings, branding, analytics, logs, and evaluations.
- **Candidate:** read-only access to their own jobs, application status, job descriptions, matches, approved/applied resumes, downloads, and timeline.

## Run locally

```bash
npm ci
npm run dev:firebase
```

Open the local URL printed by the development server and sign in with Google.

## Verify the project

```bash
npm run release:check
```

The release gate runs unit tests, Firestore and Storage emulator security tests,
TypeScript validation, a production Firebase build, UI/backend action-contract
checks, and default-deny rule checks. Do not deploy when this command fails.

An administrator can also open **Operations → Website health & operations** and
run data checks. Green checks are not proof of full end-to-end readiness; authenticated
UI flows and external integrations also need acceptance testing.

## Firebase

The public deployment is [https://chenn.web.app](https://chenn.web.app). Opening the site does not require ChatGPT or a ChatGPT login. Google Authentication protects private portal records; Firestore and Storage rules give `gopalakrishnachennu@gmail.com` administrator access and restrict candidates to their own read-only data.

Pushes to `main` run checks. Pushes to `prod` automatically run checks, deploy to
Firebase, and verify the published commit. Failed checks block deployment.
The local deployment command refuses untracked releases. See [Release process](deployment/RELEASE-PROCESS.md)
for credentials, approvals, audit history and rollback instructions.

Gmail is implemented locally but not activated or released. Its deployment is paused
while free alternatives are evaluated. See [Current status](deployment/GMAIL-MATCHING-STATUS.md).

## Deployment artifacts

The `deployment` directory contains:

- `resumeos-production-20260907-121443.tar.gz` — current validated Firebase
  production source snapshot, including release tests and configuration.
- `resumeos-production-c868cd9.tar.gz` — validated production build package.
- `resumeos-history-c868cd9.bundle` — complete portable Git history. Restore it with `git clone deployment/resumeos-history-c868cd9.bundle restored-project`.

## OpenAI

Add the OpenAI API key only through **Admin → Settings → AI provider**. On the current Firebase Spark deployment, the key remains in that administrator browser and is sent directly to OpenAI for generation. It is never written to Firestore or shown to candidates, and it can be disconnected from the same screen.
