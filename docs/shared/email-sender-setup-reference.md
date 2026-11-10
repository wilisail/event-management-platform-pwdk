# Day 6 Round 2 — shared Gmail sender setup

Updated 10 November 2026, Asia/Jakarta.

Round 1 Customer registration/login passed. Round 2 actual forgotten-password email receipt and use remains pending. Seeing a recovery form, receiving HTTP 202 or observing a provider acknowledgement does not establish inbox delivery.

## Chosen path

Wili authorized the simplest convenient option for the demo. No owned custom domain was listed in the connected Vercel team, and no previously authorized Gmail sender was found. Use one authorized personal Gmail account so that the demo does not need a domain purchase. A dedicated project account is preferable; an existing account can also be designated. It need not match the accounts used to create Vercel or Resend, or a TemuEvent customer's registration address.

The backend supports `F2_EMAIL_PROVIDER=gmail` through `feature-2/server/email/provider.ts`. The existing Resend implementation remains the default until explicitly switched. Both account recovery and organizer acceptance/rejection notifications use this same provider factory. The Gmail From address is derived from the authorized account, so the old Resend test From setting cannot override it.

## Private owner step

1. Sign into the chosen Gmail account. Enable [Google 2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification) if needed.
2. Open [Google App Passwords](https://myaccount.google.com/apppasswords), create an app password named `TemuEvent`, and keep it private. This is a separate credential from the normal Google account password. Some accounts cannot create app passwords; see [Google's eligibility instructions](https://support.google.com/accounts/answer/185833).
3. In [TemuEvent's Vercel environment settings](https://vercel.com/andor2/temuevent/settings/environment-variables), add `F2_GMAIL_USER` with the selected full Gmail address and `F2_GMAIL_APP_PASSWORD` with the generated credential. Scope both to **Preview only**, with no individual Git branch restriction, and store the password as **Secret** (called Sensitive in older interfaces). Do not paste credentials into chat, source code, screenshots or shared documentation. Do not change `F2_EMAIL_PROVIDER` yet; the operator verifies and switches it with the next deployment.
4. Tell the operator that both settings have been saved. No password or address needs to be included in that reply.

The Gmail connector in ChatGPT is not needed for this backend. Connecting an inbox to chat would not automatically give deployed TemuEvent an SMTP credential.

## Operator activation and acceptance

- Confirm the two settings exist without printing their values. Switch the Preview provider to `gmail` only when both are present.
- Deploy the reviewed standalone F2 and combined integration sources. Run `npm run email:verify:gmail` with the deployment's private settings: it authenticates to Gmail over TLS without sending an email or touching customer data. Only `GMAIL_SMTP_AUTH_OK` / a sanitized failure is logged.
- Preserve the stable session/reset signing secret and a working `F2_PASSWORD_RESET_ORIGIN`. Verify that the target Preview actually serves `/reset-password` and `/login`; the combined shell currently does not contain that recovery page.
- Move the existing scheduled email executor deliberately to the reviewed deployment using the current private Vault credentials. Vercel environment updates do not change an old immutable deployment; leaving the old executor running against the shared queue could claim jobs using the previous provider. Stop or retarget it before the first ordinary-customer recovery request. Keep the existing per-minute cadence and protection.
- Confirm readiness, both scheduled queue handlers and the correct deployed source/settings. Then tell Wili the sender is configured and give the precise recovery URL. Do not claim this state before authorization and deployment are complete.
- Wili logs out, requests recovery for the existing Customer registration email, opens the actual received email, resets the password and signs in with the replacement. Verify single use, old-session revocation and queue acknowledgement around that result. The recipient and evaluator need no Resend account or sender authorization.

## Retry and privacy boundaries

The adapter fixes the host to `smtp.gmail.com:465`, requires TLS certificate validation, disables file/URL attachment access, avoids SMTP debug logging and uses bounded connection/greeting/socket timeouts. Provider errors are replaced with the existing generic delivery error; recipient details and recovery bodies are not logged.

The existing durable queues, worker leases, attempt bounds and token/session semantics remain in force. SMTP retries reuse a hashed stable `Message-ID`, but SMTP does not provide Resend's API idempotency guarantee. A connection failure after acceptance can cause a duplicate notification on retry. An emailed reset capability still has the same expiry/single-use controls. Gmail is a low-volume demo option; a verified-domain transactional provider remains preferable for a public production release.

## F1 integration

Rizky should reuse the shared account/recovery routes and the organizer decision outbox. Do not add a second sender or send the same decision notification independently. Sender credentials stay only in the shared backend deployment; neither F1's browser nor a collaborator's laptop needs a copy. This documents the integration contract without sending a message to the collaborator.

## Automated source verification

Local typecheck, all 151 application tests and a production build in hosted API mode passed. Seven added tests cover separate sender/recipient identities, explicit provider selection, TLS/credential boundaries, recipient rejection, redacted errors, SMTP retry capability/Message-ID stability and reuse by the organizer worker. These tests inject an offline transport; they do not establish real Google authorization, SMTP acceptance or customer inbox receipt. The separate deployed SMTP-authentication probe and owner recovery test remain required after the private credentials are saved.

References: [Gmail SMTP](https://developers.google.com/workspace/gmail/imap/imap-smtp), [Nodemailer Gmail](https://nodemailer.com/guides/using-gmail), [Vercel SMTP support](https://vercel.com/kb/guide/serverless-functions-and-smtp), [recovery design](password-reset-reference.md), [decision outbox](organizer-decision-email-reference.md).

## Published source checkpoint

[PR #44](https://github.com/wilisail/event-management-platform-pwdk/pull/44) merged reviewed source `af7a4b5509c3cde3c02a4113a223d2da6a6f8bc0` into integration at `33028d108758e47da8cfcda21260bfb7748f0760`. [Integration CI 42737991391](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/42737991391) and [Feature 2 CI 42737991392](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/42737991392) passed. [PR #45](https://github.com/wilisail/event-management-platform-pwdk/pull/45) carries the same adapter into Feature 2.

Live Gmail authorization, the provider switch, new deployments and the scheduled-executor handoff are still pending. The earlier live Preview remains on Resend's test sender. Do not start the ordinary-customer inbox test until the operator confirms activation.
