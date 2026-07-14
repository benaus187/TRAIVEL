---
description: Visual design directions (1a/1b/1c), shared design tokens, and UI component patterns. Apply when writing CSS, Tailwind config, or any UI component code.
globs: ["frontend/**/*.css", "frontend/**/*.tsx", "frontend/tailwind.config*"]
alwaysApply: false
---

# Design Directions

Visual direction is **not yet chosen** — decision deferred to after Phase 0 prototype is seen in browser. Reference file: `TRAIVEL App Outlook.dc.html` (open in browser to compare all three side-by-side).

## Three options

| ID | Label | Fonts | Key colors |
|----|-------|-------|------------|
| **1a** | Fresh & energetic | Sora | `#e85d3d` coral · `#faf7f2` bg |
| **1b** | Clean & premium | Space Grotesk + Newsreader (editorial serif) + IBM Plex Mono | `#c14a2e` coral · `#f7f5f1` bg |
| **1c** | Warm wanderlust | Space Grotesk + IBM Plex Mono | `#ffb26b` amber · `#211714` dark bg |

## Shared tokens (all three directions)

- Accent: coral/orange family (specific hex depends on chosen direction)
- Verified badge green: `#1f7a45`
- Data/label font: **IBM Plex Mono** (times, reason code chips, scores, IDs)
- Image placeholders: CSS `repeating-linear-gradient` stripes until real photos land (Phase 6 via Unsplash API)

## Key UI patterns (from design canvas)

- **Reason code chips** — pill-shaped, color-coded by type, IBM Plex Mono text
- **Verification badge** — `✓ hours verified` / `✓ all stops verified` in `#1f7a45` green
- **Trend panel** — horizontal bar chart, score labels, disclaimer "sponsored and repeated content filtered out"
- **Map split view** — itinerary list left/bottom, map right/top (layout varies by direction: right-rail for 1b, inline for 1a/1c)
- **Wordmark** — TRAIVEL with "AI" in a distinct weight or color

## Extending the design canvas HTML

- Each direction: `<div class="dv-opt" id="1a|1b|1c">` — duplicate block with new ID to add a direction
- Fonts: declared in `<helmet>` block (Google Fonts)
- `data-screen-label` attribute used by the design viewer for labelling panels
