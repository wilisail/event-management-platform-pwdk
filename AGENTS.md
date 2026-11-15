# Project Temu — user-journey review

Use [current UX acceptance](docs/shared/current-ux-acceptance.md) for current owner decisions, verified behavior, blocked dependencies and the remaining seven-step acceptance sequence. Dated notes and prototype screenshots are historical evidence, not authority to restore superseded behavior.

For an application change or integration that affects a user journey:

1. Map the affected journey before editing: user goal → active role → entry screen → action → API/data effect → resulting screen. Identify F1/F2 dependencies and whether each connection is live or mocked.
2. Review the entry screen, destination and adjacent help text together. Check role/page labels and distinguish checking an order, Organizer payment decisions and Customer event feedback. When a rule changes, search nearby screens and current UX guidance for stale instructions.
3. Follow Wili's explicit decisions. Attendance is optional self-reported context for reviews; a DONE purchase and one review per Customer/event remain required. Do not invent an additional operational gate or attribute inferred details to an unavailable original assignment.
4. Use the relevant existing integration and rendered-browser checks. Preserve focused journey regressions for actual navigation/state/role defects; do not add a test for every reversible copy edit. Label fixture-based tests separately from real hosted acceptance, and name any untested dependency.
5. Before describing a journey as ready for owner testing, reconcile the tested source, running QA release and acceptance checklist. A successful build does not establish complete UX or a persisted checkout. Document clearly where a journey must stop.
6. Keep the owner's testing to a coherent tour. Reuse accepted evidence and do not repeat terminal decisions or saved reviews. Repair and investigate technical failures before returning the journey to Wili.

Rizky owns F1 and Wili owns F2. Work within the authorized scope. These instructions add no new approval requirement, no mandatory third-party review and no separate build phase for documentation-only changes.
