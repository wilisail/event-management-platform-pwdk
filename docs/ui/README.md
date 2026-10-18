# UI reference

The shared UI follows Rizky's TemuEvent feature 1 prototype pushed to this repository and accepted in [PR #1](https://github.com/wilisail/event-management-platform-pwdk/pull/1). This note records its logo, colours, typography and component styling for reuse in feature 2 and the repository welcome page.

## Original source

The source is [Rizky's feature 1 push](https://github.com/wilisail/event-management-platform-pwdk/commit/cd582753a480d68ce14e00021a52f8ec93d8372f), commit `cd582753a480d68ce14e00021a52f8ec93d8372f`. The logo comes directly from the [header in that commit](https://github.com/wilisail/event-management-platform-pwdk/blob/cd582753a480d68ce14e00021a52f8ec93d8372f/app/page.tsx).

## Logo

[temuevent-logo.png](temuevent-logo.png) is an unchanged browser export of that rendered element. It preserves the actual star glyph, font rendering, spacing and colours. The export is 560 × 112 pixels at 4× density and displays at **140 × 28 CSS pixels**. The original element measures 139.375 × 28; the export canvas rounds its width up to 140.

The earlier reconstructed SVG has been removed. [source.json](source.json) records the source markup, computed styles, commit and export hash.

## Reuse

- The repository welcome page and both feature 2 headers use this exact PNG at 140 × 28.
- Feature 2 serves a byte-identical copy from `feature-2/public/temuevent-logo.png`, through `feature-2/components/ui-logo.tsx` on the `feature-2` branch.
- Keep the original colours, glyph, typography, spacing and proportions. Reuse the asset unchanged; do not redraw or add decoration.
- An agreed logo revision updates the source export, feature 2 copy, social-preview image and page screenshots together.

## Shared UI theme

Values come from the [feature 1 stylesheet](https://github.com/wilisail/event-management-platform-pwdk/blob/cd582753a480d68ce14e00021a52f8ec93d8372f/app/globals.css) and its existing event/detail/checkout components.

| Role | Source value |
| --- | --- |
| Page background | `#fcf9ff` |
| Main text / Temu | `#11103d` |
| Star circle / focus | `#4f46e5` |
| Checkout action colour | `#5148df` |
| Event / pink accent | `#e539a7` |
| Borders | `#ebe7f5` |
| Muted text | `#77738b` |
| Font family | Arial, Helvetica, sans-serif |
| Logo type | 16px, weight 900, -0.4px spacing; captured in the PNG |
| Shared heading weight | 900 |
| Panel / action corners | 24px / 12px, matching the existing rounded-3xl / rounded-xl treatments |
| Gradient colours | `#3f41db` → `#bd2b9e` |
| Soft hero treatment | Original feature 1 `.hero-bg` gradient recipe |

Feature 2 uses these shared UI values for account, rewards, referral and organizer screens. Layouts and semantic status colours follow each screen's function. The olive/azure colours in the journey diagram identify feature ownership; they are not logo colours.

[verification.json](verification.json) records source, served-file, pixel and browser checks. The repository welcome page uses the same logo and updated app screenshot; GitHub controls the surrounding website interface.

[Social-preview PNG](temuevent-social-preview.png) uses the original exported mark. Applying GitHub's Social preview setting is a separate settings upload.
