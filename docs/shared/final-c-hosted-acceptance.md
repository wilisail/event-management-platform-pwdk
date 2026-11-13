# Final C — hosted F2 integration and D acceptance guide

Completed: **13 November 2026**. Project responsibilities: **Wili — F2; Rizky — F1**.

C is complete for its agreed scope. Controlled purchase inputs exercised the normal deployed F2 APIs and the existing scheduled worker. Two separate purchases remain for Wili's browser/inbox acceptance in D. These are integration fixtures; no real bank transfer occurred and F1 checkout/proof submission is not certified by these checks.

## Verified outcomes

| Hosted check | Result |
| --- | --- |
| Private proof | Owned PNG read; signed-out 401, Customer 403 and foreign Organizer 404; private/no-store response. |
| Approve / reject | Persisted DONE / REJECTED; reward reservations consumed / restored. Repeated decisions returned 409. |
| Points and coupon accounting | Approved test retained 5,000 points spent and the coupon consumed. Rejected test restored its 5,000 points and coupon; buyer balances were 5,000 / 10,000. |
| Deadlines and seats | Existing worker changed due fixtures to EXPIRED / CANCELED. Exactly one of four test seats remained confirmed; availability was 39/40. |
| Attendance / review | Attendance persisted, attended Customer became eligible, review POST returned 201, duplicate returned 409. |
| Notifications | Exactly one outbox row per decision. Existing worker submitted both disposable example.test messages to SMTP once; transport accepted them. This does not prove inbox receipt. |
| Preservation and cleanup | All 33 earlier purchases, ten historical pending purchases, accepted accounts and Round 4A/4B events/tickets matched their baselines. Seven temporary accounts, their event, four purchases and three proof files were removed. Two manual purchases and two private proof files remain. |

[Machine-readable evidence](evidence/final-c-hosted-2026-11-13.json). The HTTPS checks use a short-lived Preview access link and disposable application credentials. No scheduler credential was transferred. The preparation script is a maintenance utility, separate from normal application routes; its private preparation settings were retired after cleanup. The normal app remains the reviewed B release `18271371fc08a1662628a54dfd3f9da76664720c`.

## Purchases retained for D

Use the **existing accepted accounts**. No password reset or registration is needed.

- [Combined login](https://temuevent-combined-qa-andor2.vercel.app/login)
- [Organizer dashboard](https://temuevent-combined-qa-andor2.vercel.app/organizer)
- [Customer account/wallet](https://temuevent-combined-qa-andor2.vercel.app/account)
- [Test event and review entry](https://temuevent-combined-qa-andor2.vercel.app/events/9d9339b2-adb3-4f23-b2ab-fc296391201d)

Event: **QA F2 - Persetujuan dan Kehadiran**. It is intentionally in the past so attendance and post-event review can be checked now. Its records and private proofs are marked as test data, with no real payment. Both purchases are **WAITING_FOR_ADMIN_CONFIRMATION**.

| Reference | Existing Customer | Ticket / discount / payable | D action |
| --- | --- | --- | --- |
| `C-MANUAL-ACCEPT-7d7eb971` | Original Customer who earned the referral points | Rp50,000 − 5,000 points = **Rp45,000** | Accept, then mark attendance and submit a review as this Customer. |
| `C-MANUAL-REJECT-7d7eb971` | Referred Customer with the Rp25,000 coupon | Rp50,000 − Rp25,000 coupon = **Rp25,000** | Reject, then check that the coupon is available again. |

**Decision deadline: 16 November 2026, 14:58 WIB.** Complete D before then; the normal three-day cancellation rule remains active.

The original Customer now has 5,000 available points and 5,000 reserved for the first test purchase. The referred Customer's coupon is reserved for the second. These are deliberate holds, not lost rewards. Approval consumes the first hold; rejection restores the second. Profiles, passwords and previously accepted event samples are unchanged.

## D walkthrough — 25–40 minutes

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in as the existing Organizer, open the dashboard, select the named QA event and its transaction list. | Two pending references above, each with the correct Customer and amount. |
| 2 | Open `C-MANUAL-ACCEPT-7d7eb971`, inspect its private test proof, press **Terima pembayaran** and confirm. | DONE; one confirmed participant and Rp45,000 revenue. Reopening the transaction must not offer another decision. |
| 3 | Open `C-MANUAL-REJECT-7d7eb971`, inspect the proof, press **Tolak pembayaran** and confirm. | REJECTED; no extra revenue or participant. Event availability becomes 39/40. |
| 4 | Open the event's participant list and mark the approved Customer as present. | Attendance is recorded once. |
| 5 | Log out; sign in as the original Customer. Check the wallet, then open the event's review entry and submit one review. | 5,000 points remain available; attendance permits the review; duplicate submission is prevented. |
| 6 | Check both Customers' actual Gmail inboxes for their decision messages. Sign in as the referred Customer and inspect the coupon. | Acceptance/rejection messages match their references; the Rp25,000 coupon is available again. Check Spam if needed. |
| 7 | Verify logout/session separation and the evaluator's own authorized Preview access. | Each role sees its permitted data. Record actual browser/inbox observations before marking D accepted. |

The automated notification addresses used the reserved `example.test` domain. A delivery-failure notice mentioning `final-c-7d7eb971-...@example.test` is a disposable-test artifact, not evidence that a real Customer's Gmail delivery failed. D checks actual mailbox receipt separately.

Do not re-register the accepted accounts, repeat password recovery or create duplicate events for D. Further cleanup of the retained manual purchases follows acceptance; the earlier Round 4 event samples remain intact.

## Scope and remaining blocks

A source synchronization, B live F2 bindings and C hosted integration are complete. D is manual acceptance; E is the mechanics walkthrough; F is video preparation. Rizky retains F1 checkout/proof upload, event editing/deletion and event-voucher/draft behavior. Extended independent-session concurrency testing is outside this bounded pass; earlier isolated safety evidence remains separately labelled.

[Current A–F progress](final-prd-completion-progress.md) · [B implementation](final-b-live-f2-reference.md).
