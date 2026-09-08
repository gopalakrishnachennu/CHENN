# Gmail service setup

This separate server-side Worker complements the Firebase-hosted portal. Never place its secrets in frontend settings, source control, browser storage or chat. Only its HTTPS origin belongs in Admin → Gmail.

## Provisioning

From the CHENN project, after signing into the intended Cloudflare account:

```sh
npx wrangler login
npx wrangler d1 create chenn-gmail
```

Set the returned database ID in `workers/gmail/wrangler.jsonc`. Review the fixed Firebase project/database, admin email and exact portal origin before deployment. Do not grant a new administrator just to get tests working.

```sh
npx wrangler d1 migrations apply chenn-gmail --remote --config workers/gmail/wrangler.jsonc
npx wrangler secret put GOOGLE_CLIENT_ID --config workers/gmail/wrangler.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET --config workers/gmail/wrangler.jsonc
npx wrangler secret put TOKEN_ENCRYPTION_KEY --config workers/gmail/wrangler.jsonc
```

Use a securely generated 32-byte, base64/base64url-encoded encryption key. Preserve it in a secret manager: changing it without migration makes existing encrypted refresh tokens unreadable and candidates must reconnect. All secret commands prompt interactively; do not pass secrets in command arguments.

## Google configuration

- Enable Gmail API in the intended Google Cloud project and create a Web application OAuth client.
- Configure the consent screen with accurate product details, privacy policy, deletion instructions and scopes `openid`, `email`, `https://www.googleapis.com/auth/gmail.readonly`.
- Register the exact HTTPS callback `https://YOUR-SERVICE-HOST/oauth/callback`. Replace the placeholder with the actual Worker hostname; do not register a guessed URL.
- For development, add explicitly consenting test accounts. External apps in Testing generally receive Gmail refresh tokens that expire after seven days; this is not a durable public-release setup.
- Public restricted-scope use requires Google's applicable verification and security assessment for server-side restricted-data handling. Sender filtering does not exempt the application. Obtain approval before general rollout; do not promise this path is cost-free.

## Deployment and acceptance

```sh
npm run release:check
npx wrangler deploy --config workers/gmail/wrangler.jsonc
```

The `/health` endpoint reports configuration presence only, not successful Google authorization or database health. Validate those through an actual consented test connection.

Save the Worker HTTPS origin in Admin → Gmail. Enable Gmail for a test candidate. That candidate signs into their own portal, chooses approved senders/domains, accepts the sharing disclosure and uses Connect Gmail. Google may require account selection and permission approval; the website cannot legitimately skip these screens.

Test sync, wrong-account rejection, unrelated-message exclusion, permission revocation, candidate disablement, pause/resume and disconnect/delete before release. Never use another person's mailbox without their explicit authorization.

Messages are retained for 90 days and audit events for 180 days, subject to scheduled cleanup. Disconnect removes synchronized copies and attempts Google token revocation; it does not delete original Gmail messages. Treat message sender text as untrusted, and do not use this heuristic feed as the only source for critical interview or application notifications.

See `deployment/GMAIL-MATCHING-STATUS.md` for test evidence and remaining limitations.
