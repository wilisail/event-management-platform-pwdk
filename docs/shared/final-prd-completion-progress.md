# TemuEvent — final PRD completion progress

Updated: **13 November 2026, Asia/Jakarta**. Submission/video target: **17 November**.

## Current checkpoint

**A, B and C are complete for the agreed scope.** Live hosted proof permissions, approve/reject with reward accounting, duplicate prevention, attendance/reviews and scheduled expiry/cancellation passed. Temporary verification records were cleaned up; two purchases and their private test proofs remain for D. **Next: D, Wili's browser/inbox acceptance — 25–40 minutes.** [Exact references, links and walkthrough](final-c-hosted-acceptance.md). No 100% combined-project acceptance is claimed.

This is the agreed A–F plan. Keep the scope and original working-time estimates stable; update the status and evidence as each block is completed.

| Block | Bounded outcome | Original estimate | Owner | Status |
| --- | --- | --- | --- | --- |
| A — synchronize completed F2 work | Current F2 source and Rounds 5–7 records reach the appropriate submission/reference branches through reviewed PRs and passing CI. | 15–25 min | Wili | **Complete for this source checkpoint** |
| B — required live F2 connections | Bind private-proof reading, real Organizer approve/reject, reward effects and queued email; close the necessary shared deadline/restoration connections. | 40–70 min | Wili | **Complete:** merged, CI green, both Previews READY and scheduled worker verified. [Companion](final-b-live-f2-reference.md) |
| C — controlled purchases and integration checks | Prepare controlled F1-contract inputs and private test proofs; exercise genuine persisted F2 outcomes and provide exact hosted links for acceptance. | 20–35 min | Wili | **Complete:** hosted outcomes passed and manual fixtures retained. [Evidence and D guide](final-c-hosted-acceptance.md) |
| D — combined acceptance | Owner browser/inbox checks for proof, decisions, status/rewards, attendance/review handoff, sessions and evaluator access. | 25–40 min | Wili | Ready; browser/inbox/evaluator acceptance remains pending |
| E — mechanics learning | Explain actual auth/roles, tables, API/database requests, statuses, rewards and background notifications; practise evaluation questions. | 75–120 min | Wili | Pending final learning walkthrough |
| F — video preparation | Prepare the demonstration sequence, record working F2 behavior and verify the final video. | 45–75 min | Wili | Pending accepted demonstration |

The earlier rough A–D allowance remains approximately 1.5–2.5 hours of implementation/checks plus 25–40 minutes of owner acceptance. These are planning ranges, including normal PR/CI overhead, rather than guaranteed elapsed delivery times or rubric scores. F2's earlier approximately 98–100% target remains conditional on required live behavior and D passing; fixtures cannot prove completion of F1.

## A — source synchronization and evidence

Source of the reviewed work: `integration` at `cae1b7a638e5a924c6f17cc5bfd3e3b595023816`, containing merged [Round 5 #71](https://github.com/wilisail/event-management-platform-pwdk/pull/71), [Round 6 #72](https://github.com/wilisail/event-management-platform-pwdk/pull/72) and [Round 7 #73](https://github.com/wilisail/event-management-platform-pwdk/pull/73).

| Target | Result | Exact source-sync merge | Passing PR CI |
| --- | --- | --- | --- |
| `feature-2` | [PR #74 merged](https://github.com/wilisail/event-management-platform-pwdk/pull/74); standalone F2 source, runnable standalone checks and shared records synchronized. | `04639a2769710e04243e46f0a00ce5c15abf6cbe` | [Feature 2 CI](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43374532940) |
| `main` | [PR #75 merged](https://github.com/wilisail/event-management-platform-pwdk/pull/75); current F2 module, corresponding shared schema/migration source, standalone checks and records synchronized. | `dcaa1c1691a7910c1df8c5a0a3767aa43f3547e6` | [Feature 2 CI](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43374572331) |

At the historical A checkpoint, all **146 tracked files under `feature-2/`** matched the reviewed integration source on both targets, at subtree `0958686b8f4239174c4ae10924bef314669bdc3a`. B's newer matching snapshot is recorded below. The root F1 application was not copied into either branch. The combined app, root Prisma client and root-dependent Day 7/Round 6 runners stay on `integration`; the full combined release remains a later acceptance/release checkpoint.

The source sync preserves main-only preflight, developer-access and optional-tooling notes. Shared documentation is copied without deleting branch-only references. The stale opening completion-plan checkpoint is replaced by a link to this record; dated historical reports retain their original evidence and limitations.

### Verification

Both PRs passed Node 22 CI: F2 typecheck; **159 application tests**; nine disposable migration replays and restricted-role HTTP/rollback/scheduler/statistics/attendance checks; **two operations tests**; **11 existing isolated Round 5 regression groups**; Round 7 verifier syntax; and the F2 production build. Source identity and whitespace checks also passed.

CI exposed an existing portability issue in the Round 5 harness: its Express types/runtime lookup implicitly relied on root dependencies from the combined app. The harness now derives the app type from the F2 app and resolves Express through the F2 package. Both corrected PRs passed the complete standalone check sequence. This small QA fix is carried back to integration with this progress record; application source is unchanged by that follow-up.

This pass used disposable data and captured email in CI. It did not perform live database migrations, mutate accepted records, send decision emails, change provider settings or manually deploy a hosted release. Existing Round 4A/4B samples and the protected Preview remain the carried-forward checkpoint.

## B — completed live connections, 13 November

| Branch | Merged source PR | Passing CI |
| --- | --- | --- |
| `integration` | [#79](https://github.com/wilisail/event-management-platform-pwdk/pull/79), merge `18271371fc08a1662628a54dfd3f9da76664720c` | [F2](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43378930914) and [Integration](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43378930926) |
| `feature-2` | [#80](https://github.com/wilisail/event-management-platform-pwdk/pull/80), merge `1d66509ee8605cf85ea72d6f24dc238d77833863` | [F2](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43379234214) |
| `main` | [#81](https://github.com/wilisail/event-management-platform-pwdk/pull/81), merge `8a85ce6bbd158de89cb99f88968d46324a579529` | [F2](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43379289359) |

At B's source checkpoint, all **149 F2 files** matched across these branches at subtree `9f3ea7a889e4aaac037983f4269770cfeb93ec4a`. Standalone Round 5/7 CI steps remain preserved; combined root-dependent checks remain on integration. Validation passed **165 F2 application tests**, the existing migration/operations/Round 5/6/combined checks, nine new real-runtime SQL scenario groups, typechecks and both app builds.

| Preview | Verified release | Result |
| --- | --- | --- |
| [Combined account/Organizer app](https://temuevent-combined-qa-andor2.vercel.app/login) | `dpl_HuUEdtRwkPMsz7Bk9hpPNryoaKni` | READY; health and readiness HTTP 200; private-proof, decision and deadline bindings configured |
| [Standalone F2/worker compatibility entry](https://temuevent-f2-qa-andor2.vercel.app/account) | `dpl_CNi5G1uXN7CH1baYdzDacqrhd41K` | READY; health and readiness HTTP 200; the existing scheduler still uses this alias |

Both are Next.js / Node 22 **Preview** releases built from exact reviewed merge `18271371fc08a1662628a54dfd3f9da76664720c`. Only the existing QA aliases were reassigned after readiness passed; Production and project protection were not changed.

The existing `temuevent-preview-email-jobs` minute executor returned HTTP 200 at **13:37 and 13:38 WIB**, with `purchaseDeadlines`, `passwordReset` and `decisionEmails` all true. The new private `payment-proofs` bucket is PNG/JPEG only and bounded to 5 MiB. Preview's persisted deadline cutoff is 13 November 00:00 UTC, preserving all ten historical pending October demo purchases. Event/ticket fingerprints and all purchase status counts match the pre-release baseline; no accepted sample or real account was mutated. No error/fatal logs were returned for these deployments in the checked 15-minute window.

[Implementation and mechanics](final-b-live-f2-reference.md) · [Isolated runtime evidence](evidence/final-b-runtime-isolated-2026-11-13.json) · [Hosted release/worker/preservation evidence](evidence/final-b-hosted-2026-11-13.json).

## C — completed hosted integration, 13 November

[Hosted results and D walkthrough](final-c-hosted-acceptance.md) · [Evidence](evidence/final-c-hosted-2026-11-13.json).

Normal deployed endpoints returned the expected owned-proof access and denials, persisted approval/rejection and consume/restore effects, duplicate 409s, attendance, eligible review creation and duplicate prevention. The existing scheduled worker executed expiry/cancellation and restored seats. Reconciliation matched expected statuses, points, coupons and one confirmed seat. One notification per decision was submitted to SMTP using disposable example.test recipients; actual inbox receipt remains D.

Seven temporary accounts, their event, four purchases and three proof files were removed. Two manual purchases and two private proofs remain in the existing Organizer/Customer accounts. Accepted account/event/ticket fingerprints and all 33 earlier purchases matched the baseline; all ten old pending purchases remain preserved. The guide records the deliberate 5,000-point and Rp25,000-coupon holds and the **16 November, 14:58 WIB** decision deadline.

C exceeded the original planning range because of test-access setup and preparation-script corrections. Product scope did not expand. The final HTTPS runner uses a temporary deployment link; no scheduler credential was transferred. Normal application routes and the reviewed B running release are unchanged.

C seeds representative F1 inputs and verifies genuine F2 outputs. It is functional/integration testing, followed by D's user acceptance; it does not itself establish TDD or complete F1 checkout/proof upload. Extended multi-session concurrency work remains outside this pass.

Rizky retains checkout/proof submission, event edit/delete and voucher/draft implementation. The fetched `feature-1` head remains `c497ddf04a56a03295571628471e3e4d8429f487`; C does not edit it.

## Mechanics of A

A branch identifies a saved code snapshot. A PR makes the proposed changes reviewable; CI installs and checks that proposed snapshot before merge. Merging puts the verified files into the target branch. A hosted deployment is a separate running release, so a successful source sync alone does not establish browser/inbox acceptance. The source hashes and linked checks above allow the next session to resume without recreating accepted samples or repeating completed account tests.

Related records: [B live connections](final-b-live-f2-reference.md), [Round 7 handoff and owner checklist](day-7-round-7-f2-handoff.md), [11 November recap](work-session-2026-11-11.md), [completion plan](feature-2-completion-plan.md), [repository workflow](repository-workflow.md).
