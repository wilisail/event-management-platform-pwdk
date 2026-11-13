# TemuEvent — final PRD completion progress

Updated: **13 November 2026, Asia/Jakarta**. Submission/video target: **17 November**.

## Current checkpoint

**A is complete: the reviewed F2 source and completed-round evidence have been synchronized through passing, merged PRs. B and C have not started in this completion pass.** Round 7 remains the completed automated checkpoint; the live purchase/proof/decision connections and positive browser/inbox acceptance are still open. Completing A does not establish 100% F2 or combined-project acceptance.

This is the agreed A–F plan. Keep the scope and original working-time estimates stable; update the status and evidence as each block is completed.

| Block | Bounded outcome | Original estimate | Owner | Status |
| --- | --- | --- | --- | --- |
| A — synchronize completed F2 work | Current F2 source and Rounds 5–7 records reach the appropriate submission/reference branches through reviewed PRs and passing CI. | 15–25 min | Assistant | **Complete for this source checkpoint** |
| B — required live F2 connections | Bind private-proof reading, real Organizer approve/reject, reward effects and queued email; close the necessary shared deadline/restoration connections. | 40–70 min | Assistant | Not started; normal runtime connections remain outstanding |
| C — controlled purchases and integration checks | Prepare controlled F1-contract inputs and private test proofs; exercise genuine persisted F2 outcomes and provide exact hosted links for acceptance. | 20–35 min | Assistant | Not started; follows B |
| D — combined acceptance | Owner browser/inbox checks for proof, decisions, status/rewards, attendance/review handoff, sessions and evaluator access. | 25–40 min | Wili, assisted | Pending B/C; no new acceptance claimed here |
| E — mechanics learning | Explain actual auth/roles, tables, API/database requests, statuses, rewards and background notifications; practise evaluation questions. | 75–120 min | Wili + assistant | Pending final learning walkthrough |
| F — video preparation | Prepare the demonstration sequence, record working F2 behavior and verify the final video. | 45–75 min | Wili + assistant | Pending accepted demonstration |

The earlier rough A–D allowance remains approximately 1.5–2.5 hours of assistant work plus 25–40 minutes of owner acceptance. These are planning ranges, including normal PR/CI overhead, rather than guaranteed elapsed delivery times or rubric scores. F2's earlier approximately 98–100% target remains conditional on required live behavior and D passing; fixtures cannot prove completion of F1.

## A — source synchronization and evidence

Source of the reviewed work: `integration` at `cae1b7a638e5a924c6f17cc5bfd3e3b595023816`, containing merged [Round 5 #71](https://github.com/wilisail/event-management-platform-pwdk/pull/71), [Round 6 #72](https://github.com/wilisail/event-management-platform-pwdk/pull/72) and [Round 7 #73](https://github.com/wilisail/event-management-platform-pwdk/pull/73).

| Target | Result | Exact source-sync merge | Passing PR CI |
| --- | --- | --- | --- |
| `feature-2` | [PR #74 merged](https://github.com/wilisail/event-management-platform-pwdk/pull/74); standalone F2 source, runnable standalone checks and shared records synchronized. | `04639a2769710e04243e46f0a00ce5c15abf6cbe` | [Feature 2 CI](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43374532940) |
| `main` | [PR #75 merged](https://github.com/wilisail/event-management-platform-pwdk/pull/75); current F2 module, corresponding shared schema/migration source, standalone checks and records synchronized. | `dcaa1c1691a7910c1df8c5a0a3767aa43f3547e6` | [Feature 2 CI](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43374572331) |

All **146 tracked files under `feature-2/`** match the reviewed integration source on both targets. The identical F2 subtree is `0958686b8f4239174c4ae10924bef314669bdc3a`. The root F1 application was not copied into either branch. The combined app, root Prisma client and root-dependent Day 7/Round 6 runners stay on `integration`; the full combined release remains a later acceptance/release checkpoint.

The source sync preserves main-only preflight, developer-access and optional-tooling notes. Shared documentation is copied without deleting branch-only references. The stale opening completion-plan checkpoint is replaced by a link to this record; dated historical reports retain their original evidence and limitations.

### Verification

Both PRs passed Node 22 CI: F2 typecheck; **159 application tests**; nine disposable migration replays and restricted-role HTTP/rollback/scheduler/statistics/attendance checks; **two operations tests**; **11 existing isolated Round 5 regression groups**; Round 7 verifier syntax; and the F2 production build. Source identity and whitespace checks also passed.

CI exposed an existing portability issue in the Round 5 harness: its Express types/runtime lookup implicitly relied on root dependencies from the combined app. The harness now derives the app type from the F2 app and resolves Express through the F2 package. Both corrected PRs passed the complete standalone check sequence. This small QA fix is carried back to integration with this progress record; application source is unchanged by that follow-up.

This pass used disposable data and captured email in CI. It did not perform live database migrations, mutate accepted records, send decision emails, change provider settings or manually deploy a hosted release. Existing Round 4A/4B samples and the protected Preview remain the carried-forward checkpoint.

## B/C boundaries and next action

Start B from the current integration branch and reuse the services already implemented. A real authorized proof read and a real persisted Organizer decision are required F2 behavior; the QA adapter is not evidence that normal runtime is connected. Verify shared two-hour expiry/three-day cancellation and the corresponding reward restoration through the agreed interfaces. Prevent repeated decisions/restoration; a separate extended multi-session concurrency project is outside this bounded pass unless a concrete failure requires it.

C may seed representative F1 inputs so F2 can be demonstrated independently. Approval/rejection, reward changes, attendance and the review handoff must then execute through real protected services and persist. Hosted fixtures are functional/integration-test preparation, followed by D's user acceptance. They do not themselves establish TDD or complete the customer's F1 checkout/proof-upload journey.

Rizky retains checkout/proof submission, event edit/delete and voucher/draft implementation. The fetched `feature-1` head remains `c497ddf04a56a03295571628471e3e4d8429f487`; A does not edit it. Final acceptance must distinguish tested F2 outputs from unfinished F1 inputs.

## Mechanics of A

A branch identifies a saved code snapshot. A PR makes the proposed changes reviewable; CI installs and checks that proposed snapshot before merge. Merging puts the verified files into the target branch. A hosted deployment is a separate running release, so a successful source sync alone does not establish browser/inbox acceptance. The source hashes and linked checks above allow the next session to resume without recreating accepted samples or repeating completed account tests.

Related records: [Round 7 handoff and owner checklist](day-7-round-7-f2-handoff.md), [11 November recap](work-session-2026-11-11.md), [completion plan](feature-2-completion-plan.md), [repository workflow](repository-workflow.md).
