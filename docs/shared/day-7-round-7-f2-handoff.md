# Day 7 — Round 7 automated F2 handoff

Updated 11 November 2026, Asia/Jakarta. This checkpoint finishes the independent automated F2 handoff work. Final combined purchase acceptance, actual purchase-decision inbox receipt and the evaluator's own session remain separate human/integration checks. Do not describe these as 100% accepted from automated evidence alone.

The direct hosted verifier passed **35 checks**. Its report excludes the earlier connector responses that could not distinguish application 401s from platform protection.

## Release and automated result

The combined protected Preview now runs the reviewed Round 6 integration source `d020ac91a03bba65fac0c438775cbe1be4cc7352`, tree `4ccdf066dc0aa5c9f31b20f2e30f43d06c9604a7`. [Round 6 PR #72](https://github.com/wilisail/event-management-platform-pwdk/pull/72) and both PR CI jobs passed; the merge commit's [Integration CI](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43038663868) also passed on Node 22. The hosted Preview build is READY. Its deployment override installs both locked root/F2 dependency trees and builds the combined application. No Production release or global project-setting change was made.

Use the existing stable combined Preview as the common entry point for the account, Organizer, event and review flows. It was moved only after readiness, page shells and preserved public-event data checks passed. The separate F2 compatibility/reset/worker entry remains unchanged. A source merge and a hosted deployment are now both complete for the independent F2 code; the remaining purchase/proof provider/transition bindings are still absent from normal runtime startup.

Verified entry points: [Login](https://temuevent-combined-qa-andor2.vercel.app/login) · [My account](https://temuevent-combined-qa-andor2.vercel.app/account) · [Organizer dashboard](https://temuevent-combined-qa-andor2.vercel.app/organizer). Open these in a browser with authorized Vercel access, then sign into TemuEvent with the intended account. These are separate sign-ins; no credential is included in this report.

| Check | Result |
| --- | --- |
| Protected Preview | Unauthenticated browser navigation reaches Vercel sign-in. Protection remains enabled. |
| Readiness and shared database | HTTP 200 with `ready: true`; the session service is configured. |
| Deployed pages | Login, register, account, Organizer, recovery and reset shells load; preserved public detail/review/ticket routes are present. HTTP page-shell checks do not establish hydrated visual or signed-in owner acceptance. |
| Signed-out data access | Identity, CSRF, wallet/referral, Organizer events/statistics/attendees, private proof and review eligibility return application JSON 401 with no-store. These checks explicitly separate TemuEvent denial from Vercel protection. |
| Signed-out writes | Event creation, review creation, attendance marking, purchase decisions and the private worker reject unauthenticated requests before an action can execute. No accepted write, real payment or external email is initiated by this verifier. |
| False identity/origin | A demo-persona header cannot become an Organizer session; an unapproved origin is rejected. The normal hosted app has no `/qa` persona launcher. |
| Shared schema and privacy | All nine migration checksums match. Attendance, review, reset and outbox tables retain RLS. The profile bucket remains private; anonymous/authenticated Data API roles lack private-schema usage. No migration or privilege change is applied. |
| Worker | The existing minute scheduler is active and Vault-backed. Recent runs succeeded and worker HTTP responses report both reset and decision-email queues enabled. Queue health does not prove a real decision email reached an inbox. |
| Preserved samples and cleanup | Accepted Round 4A/4B events remain published under their owner, with Rp10,000 tickets and five/three available seats. The poster is retained for 4B. Both samples still have zero purchases. Legacy Day 6 QA identities count zero; Rounds 5/6 used disposable databases, so this session has no new shared fixtures to delete. |

[Sanitized hosted evidence](evidence/day-7-round-7-hosted-2026-11-11.json) · [Read-only operations/preservation evidence](evidence/day-7-round-7-operations-2026-11-11.json)

The Vercel fetch helper initially treated application 401s as possible platform access failures, so those responses were excluded from the pass count. The direct verifier entered the owner's temporary, origin-scoped platform share access and made requests without any TemuEvent session. It confirmed actual JSON denials. No access token, share capability, cookie, owner identity or credential belongs in the reports or public repository. The separate cloud browser had no signed-in Vercel session; its observation establishes the protection screen, not a new signed-in UI pass.

## Reproduce or resume

The new `database/scripts/verify-round7-hosted.mjs` runner uses Node 22.12+ built-ins. Supply the selected protected Preview origin, an owner-authorized short-lived Vercel share URL through `TEMUEVENT_QA_SHARE_URL`, and optional explicit accepted-event expectations through `TEMUEVENT_QA_SAMPLES`. Keep the access URL outside source/history and never print it. The runner acquires no app session, follows bootstrap redirects only within the selected origin, rejects non-TemuEvent Preview hosts and writes only sanitized check names/statuses to its report.

```sh
node database/scripts/verify-round7-hosted.mjs --origin "$TEMUEVENT_PREVIEW_ORIGIN" --report /tmp/temuevent-round7-hosted.json
```

The runner's POST checks intentionally have no application session or worker secret and must be denied. Do not add real credentials or an authorized worker header to this smoke verifier. Positive Customer/two-Organizer ownership, CSRF, decision/reward and attendance/review writes retain the exact-source Rounds 5/6 isolated evidence and CI coverage. This live smoke is not a new credentialed-role replay or real F1 purchase journey.

Integration CI syntax-checks the hosted runner without preview credentials. Existing Rounds 5/6 CI groups remain enabled. Resume from this release and the saved reports; preserve accepted samples rather than recreating them after an interruption.

## Owner checks across Rounds 5–7

All automated work above needs no standby. The owner can wait and combine the remaining positive checks into one **20–35 minute** session after reachable purchase/proof/decision fixtures are prepared. Estimates assume working F1 interfaces and ordinary sign-in; they exclude fixing missing interfaces or permissions.

| Round | Owner actions | Attention | Ready now? |
| --- | --- | --- | --- |
| 5 | On two prepared purchases, inspect the private test proof; approve one and reject the other. Check the Customer's final status, wallet/reward outcome and actual inbox messages. Use a clearly marked test image; no money transfer is needed. | 10–15 min | Positive approval/rejection remains blocked by the unbound F1 purchase/proof/transition path. Do not wait online or attempt these against the empty Round 4 samples. |
| 6 | Mark the approved DONE participant as attended, then use that Customer to submit one review. Reopen the event/Organizer rating, check duplicate prevention and confirm a non-attended Customer cannot submit. | 5–10 min | Positive review acceptance needs a confirmed participant. Current accepted events have no purchases. The service/SQL path is automated and tested; no fake live attendance is created here. |
| 7 | In the evaluator's own authorized session, open the protected Preview and use the intended Customer/Organizer demo accounts. Check navigation, mobile readability, logout/session behavior and the final agreed demo. Share credentials privately. | 5–10 min | Basic access/navigation can be checked now. Full final signoff follows the Round 5/6 positive journey. Evaluator Vercel access must be checked in the evaluator's own session. |

Optional now, **5–10 minutes**: open the stable combined `/login`, sign in as the existing Organizer, inspect the two preserved event entries and then sign in as a Customer on `/account`. Open a preserved event's **Lihat dan tulis ulasan** link; a Customer with no purchase should see the purchase-required message, while an Organizer must use a Customer account. Zero sales/participants on these two samples is expected. This is a useful deployed navigation/negative-gating check, not the positive purchase acceptance. Do not re-register accepted accounts, repeat password recovery or create duplicate events merely for this handoff.

Exact event/purchase links for the positive journey must be supplied and verified after those fixtures/interfaces exist. Final approved QA cleanup and final completion/score assessment come after that acceptance; the currently preserved Round 4 samples stay intact until the owner decides otherwise.
