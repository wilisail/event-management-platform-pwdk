# Day 4 Part 2 — Organizer decision boundary

Updated 4 November 2026. Feature 2 now has the local decision endpoint and dashboard controls. TypeScript and the production build passed. The shared purchase transition still needs to be connected. The runtime does not inject a placeholder or update purchases directly.

1. The organizer opens an owned purchase. The server reports whether the purchase is pending within its stored decision deadline and whether the shared transition is connected.
2. The dashboard offers Accept and Reject when the server reports readiness. It asks for confirmation, submits through the existing session/CSRF client and reloads the transaction and list after success. An uncertain result prompts a read of the current state before another decision.
3. `POST /api/organizer/transactions/:transactionId/decision` accepts only `ACCEPT` or `REJECT` in a small JSON body. The verified session supplies the organizer ID. Express requires the organizer role and session-bound CSRF. A missing or foreign purchase is 404. A closed, non-pending or deadline-expired purchase is 409. An eligible purchase without a connected transition is 503 and cannot be changed.
4. The shared engine must recheck ownership, status and the fresh deadline in its database transaction. The preliminary F2 read can go stale. Accept commits `DONE`; reject commits `REJECTED` and restores applicable seats, event voucher and recorded reward allocations. F1 timeout and F2 rejection use the same transition rules. Part 4.3 will add the notification outbox record to the same commit.

**Proposed adapter.** `OrganizerDecisionTransition` receives `{ organizerId, transactionId, decision }`. It returns `APPLIED` after commit, `NOT_FOUND` for a missing or foreign purchase, or `CLOSED` when a deadline or competing transition wins. Agree on the implementation with F1 before enabling it. Reuse the [existing reward core](reward-operations-reference.md) in the same SQL transaction. Avoid calling a separate independently committed reward write over HTTP.

**Integration evidence still due.** Use a real F1 checkout and uploaded proof, test both decisions from an owning organizer account, deny a customer and another organizer, and exercise deadline equality, duplicate submissions, and simultaneous rejection and timeout. Inspect the resulting purchase, seat, voucher, coupon and point records. Confirm the customer-facing status matches the organizer view. Proof access and the real shared engine are release gates for the decision flow.

**Learning checkpoint.** A role tells us which actions a person may take. Ownership tells us which purchases they can act on. A CSRF token ties the browser write to its own session. None of these makes the purchase update atomic. To avoid restoring seats twice, the shared engine must let only one concurrent transition win and write all related changes together.

Implementation: `feature-2/server/organizer/decision.ts`, `feature-2/server/protected-http.ts`, and `feature-2/components/organizer-dashboard.tsx`. See the [transaction reads companion](organizer-transactions-reference.md) and [completion plan](feature-2-completion-plan.md).
