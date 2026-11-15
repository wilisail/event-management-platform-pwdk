# D — browser acceptance and corrections

Updated: **15 November 2026, Asia/Jakarta**. Responsibilities: **Wili — F2; Rizky — F1**.

D is **partially accepted**. Wili's screenshots demonstrate real hosted decisions and inbox delivery. They also exposed UI and QA-fixture defects. The original A–F scope is unchanged; this is correction work within D, followed by the remaining acceptance and learning walkthroughs.

| Observation | Diagnosis and correction | Acceptance status |
| --- | --- | --- |
| Proof/back/signup controls overlap text | Shared padded anchor controls had no layout box. Shared F2 controls now use inline-flex; proof text and actions have separate rows. Styles stay inside `.f2-ui`. | Responsive browser regression passed at 1280, 360 and 320 px in standalone and combined builds. The corrected hosted layout was inspected; Wili's final acceptance remains. |
| Participant section still says to choose an event | The screenshot shows no participant event selected. The database contains one DONE purchase/ticket for the QA event. There was also a real refresh gap after a decision. Buttons now identify the event, approval selects it by transaction event ID, and the list refreshes after decisions. DONE details have a participant shortcut and the list has a refresh button. | Confirmed in the hosted browser: Xu Harga, one ticket, Rp45,000. Attendance remains unmarked. |
| Original Customer has 5,000 points | Initial referral grant 10,000 minus 5,000 consumed by the DONE purchase. The first Customer's zero coupon count is expected. | Screenshot and backend agree. Full event-to-payment learning flow is deferred. |
| Both decision messages reach one inbox | Rejection uses the referred account's Gmail `+` alias, which reaches the same mailbox. References distinguish the two purchases. | Both actual inbox messages observed; no new notification was sent by this correction pass. |
| Customer sees 403 after signing in from an Organizer link | Role guard worked, but login reused the Organizer return path. Login now returns that Customer to `/account`; deliberately opening an Organizer page still enforces the guard. | Role-aware return cases tested; owner session walkthrough remains. |
| Proof image contains rectangles | Server-side SVG text was rendered without a usable font. The maintenance generator now uses a bundled licensed font. Only the two controlled private QA PNGs were replaced and read back with matching SHA-256 values. | Replacement readback hashes match. The live owned-proof endpoint was opened in the hosted browser and displays readable text. |
| Forgotten referred-account password | The account exists; its password is hashed and cannot be recovered as plaintext. | Reset remains last/later, as requested. No credential changed. |

## Preserved manual outcomes

- `C-MANUAL-ACCEPT-7d7eb971`: **DONE**, Rp50,000 subtotal − 5,000 points = **Rp45,000**; one confirmed participant/ticket.
- `C-MANUAL-REJECT-7d7eb971`: **REJECTED**, Rp25,000 coupon restored; no confirmed ticket/revenue from this purchase.
- QA event seat availability: **39 / 40**. These decisions are already complete; do not submit them again.
- The proof correction replaces QA object bytes only. Purchase references, proof keys/upload times, account credentials and reward effects are preserved.

## Verification and release

[Correction PR #89](https://github.com/wilisail/event-management-platform-pwdk/pull/89). F2 typecheck and **167 application tests** pass locally; the combined typecheck and **six integration tests** pass. CI additionally builds both apps, replays isolated database checks and runs the rendered browser regression. The browser regression uses isolated API fixtures on localhost and sends no real email or account mutations. It does not substitute for Wili's hosted acceptance.

The proof renderer is a maintenance/test utility, separate from normal API routes. Its explicit font file avoids dependence on server fonts and makes distinct purchase references render distinct glyphs. Existing private proof authorization, file validation and no-store headers remain enforced. Original fixture hashes were identical despite distinct references; the replacement hashes are distinct and match readback.

## Published correction checkpoint

All correction PRs are merged and their required CI is green:

| Branch | PR | Merge | Passing checks |
| --- | --- | --- | --- |
| `integration` | [#89](https://github.com/wilisail/event-management-platform-pwdk/pull/89) | `6518bef88ffe65ef2379802af7982e234f81c48c` | [F2](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43607222585), [Integration](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43607222584) |
| `main` | [#90](https://github.com/wilisail/event-management-platform-pwdk/pull/90) | `58772afafb2c9329d81a0a3143b669b76548bda0` | [F2](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43607339937) |
| `feature-2` | [#91](https://github.com/wilisail/event-management-platform-pwdk/pull/91) | `025c49596ab24cf0d175dad68258ba4ba72b0a27` | [F2](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43607407749) |

Both corrected Node 22 / Next.js Previews were built from exact reviewed integration merge `6518bef88ffe65ef2379802af7982e234f81c48c`. Health and database readiness returned HTTP 200 before the existing aliases were reassigned:

- Combined: `dpl_4aKk5XM7tG3awHuQwX9vcHy5b3L2`, [Organizer dashboard](https://temuevent-combined-qa-andor2.vercel.app/organizer).
- Standalone F2/worker: `dpl_4a9tE42eX3e24K1Ta2Uk29K23Spo`, [account entry](https://temuevent-f2-qa-andor2.vercel.app/account).

Production and deployment protection were not changed. The scheduler retains its existing alias and credentials. Preserved purchase, account, redemption, event and ticket fingerprints match the pre-correction baseline. No attendance, review, password or decision email was added. The temporary proof-only repair is bounded to its two fixed QA keys and expires on 14 November at 18:00 UTC; it is not a normal product endpoint.

The actual hosted browser confirmed the selected participant row and completed transaction, with a readable private proof at the existing owned endpoint. These read-only inspections supplement the isolated browser regression; Wili still owns final user acceptance. [Sanitized correction evidence](evidence/final-d-corrections-2026-11-14.json).

## Resume D after the corrected release

1. Sign in as Organizer at the [combined dashboard](https://temuevent-combined-qa-andor2.vercel.app/organizer). Click **Lihat peserta** on **QA F2 - Persetujuan dan Kehadiran**, or open the DONE transaction and click **Lihat peserta event ini**. Expect the original Customer, one ticket and Rp45,000.
2. Mark that Customer present once. Log out, then sign in as the original Customer and open the [event](https://temuevent-combined-qa-andor2.vercel.app/events/9d9339b2-adb3-4f23-b2ab-fc296391201d) to submit the post-event review.
3. Later, complete the requested learning walkthrough from event creation through purchase/proof, payment decision, rewards and attendance/review. Amounts are rupiah (IDR), not dollars. F1 checkout/proof submission still needs its own functional acceptance.
4. Complete step 7 together: sign out, revisit the restricted page, sign in with the other role, check permitted navigation and verify the evaluator's own authorized Preview access. The observed Customer 403 alone does not complete this test.
5. Reset the referred Customer's password last, then inspect the restored coupon through its own account.

Event poster upload/Cloudinary is part of F1 event creation. F2 need not duplicate that implementation. The combined app's existing F1 poster integration and Round 4B evidence remain relevant to whole-project evaluation; the final score depends on the evaluator and the combined result.

New F1 checkpoint: `3ea06774a8461d649943fb95fc1f0c97af3f192e`, **14 November, 20:19 WIB**, “Adding Transaction Page Mockup”. This correction pass does not merge it or certify the new mockup as completed checkout.

[Current A–F progress](final-prd-completion-progress.md) · [Original C/D guide](final-c-hosted-acceptance.md).

## Owner acceptance checkpoint — 15 November

Wili accepted the corrected control layout and readable private proof. Screenshots and read-only backend queries confirm:

- Original Customer attendance was marked by **QA Organizer 1**, role **ORGANIZER**, at **15 November 2026, 13:06:08 WIB**. The Customer did not self-mark attendance.
- **Xu Harga** submitted one persisted **four-star review** at **13:11:01 WIB**. The existing unique event/customer review record is present.
- The manual purchase outcomes remain DONE / Rp45,000 and REJECTED / Rp25,000; both private proof objects exist. This pass changed no purchase, account, password or provider setting.
- The referred Customer's Rp25,000 coupon is restored and currently available. Its own-account browser acceptance remains pending; the password lookup did not recover an earlier plaintext value and reset remains deferred.
- The existing **30** DEMO-20261028 purchases remain: five in each of the six statuses. They belong to three legacy organizers (Jakarta Coffee Collective 14, Bandung Music Community 15, Jakarta Tech Community 1), all separate from the current QA Organizer. Those legacy organizer seed identities have no login password set. There are 35 purchases overall; the current Organizer owns three events and two purchases.
- This QA attendance/review event has no poster URL or provider ID. **QA Round 4B - Poster Form** does have both. The deployed creation page contains the image upload control.
- Remaining D owner checks: step 7 logout/role separation and evaluator access; referred-Customer own-account coupon UX. D is still partial.

The payment decision confirms the manual payment proof; attendance is a separate check-in record used by review eligibility. A paid no-show does not lose DONE status simply because no attendance is recorded. The requirement notes describe reviews by attendees; the specific manual check-in mechanism is an implementation choice, not established verbatim original-assignment wording.

For later demo preparation, use more engaging event names and suitable posters while retaining clear test-data descriptions. Do not change the accepted test identities/references or reassign the old demo organizers' records merely to fill the current dashboard.
