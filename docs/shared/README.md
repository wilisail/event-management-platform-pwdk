# Shared project record

Updated: 1 November 2026.

| Reference | Contents |
| --- | --- |
| [Password change and session revocation](password-change-reference.md) | Day 3 part 2: current-password proof, atomic all-session revocation, login/refresh/logout races, browser behavior and learning notes |
| [Profile editing and pictures](profile-upload-reference.md) | Day 3 part 1: own-name/photo flow, validation, storage versus SQL, provider setup/verification limits, and Day 3–6 Feature 1 dependency map |
| [Reward operations](reward-operations-reference.md) | Shared transaction-aware reserve/consume/restore core, integration contract, allocation and race tests |
| [Wallet and referral reads](wallet-reference.md) | Authenticated balances/coupons/referral counts, expiry, owner filters, read snapshots and learning notes |
| [Referral signup](referral-registration-reference.md) | Atomic account/referral/reward issuance, configurable coupon, rollback/retry tests and learning notes |
| [Referral/reward database](referral-reward-schema-reference.md) | Five reward tables, ownership/duplicate-use constraints, migration, live checks and learning notes |
| [Frontend authentication](frontend-authentication-reference.md) | Connected signup/login, account and organizer pages; cookies, client coordination and verification limits |
| [Feature 2 completion plan](feature-2-completion-plan.md) | Dated remaining subtasks, time ranges, feature 1 dependencies and full submission checklist |
| [Repository workflow](repository-workflow.md) | Feature branch freedom, owner-managed integration, review process and active branch rules |
| [Shared Prisma starter](../../database/README.md) | Live event/ticket/purchase tables, 30 sample purchases and runnable Prisma connection |
| [Registration reference](registration-reference.md) | Implemented backend signup, input rules, password hashing, safe responses and live verification |
| [Login/session reference](login-session-reference.md) | Password login, cookies/JWTs, rotating refresh, CSRF, logout and learning checkpoint |
| [Authorization reference](authorization-reference.md) | Session/role/CSRF guards, ownership checks, protected identity and organizer reads |
| [Account/session foundation](account-session-foundation.md) | Applied session/token models, relationships, full-stack mechanics and course mapping |
| [Database setup](database-setup.md) | Shared Supabase project, verified connection and migration record |
| [Connection check](database-check/README.md) | Runnable backend connection check, public certificate, environment template and instructions |
| [Technical reference](technical-reference.md) | Database/backend defaults, API contracts, ownership and change impacts |
| [Project record](consistency.en.md) | Styling, current stack, ownership and interfaces |
| [UX reference](ux-reference.md) | Working defaults, alternatives, PRD sources, website references and change impacts |
| [UI reference](../ui/README.md) | Rizky's feature 1 source, shared logo, colours, typography and component styling |
| [UI previews](../previews/README.md) | Feature 1 and feature 2 screenshots |

The UX and technical references record working defaults supplied by Wili, open to changes following input. Record a change with its date, reason and effect on feature 1 and feature 2 so both builders and their coding agents use the same reference.

The canonical link is `main/docs/shared`. Updates are also carried into `integration`.

