---
description: Visual design directions (1a/1b/1c), shared design tokens, and UI component patterns. Apply when writing CSS, Tailwind config, or any UI component code.
globs: ["frontend/**/*.css", "frontend/**/*.tsx", "frontend/tailwind.config*"]
alwaysApply: false
---

# Design Directions

**Direction 1a ("Fresh & energetic") was chosen and shipped in Phase 6.** The original design canvas (`design/TRAIVEL App Outlook.dc.html`, archived — see below) offered 3 candidate directions during Phase 0; 1a is the one wired into `frontend/src/app/globals.css` and `layout.tsx`. This file now documents the shipped tokens, not open options.

## Shipped tokens

| Token | Value |
|-------|-------|
| Primary/accent (coral) | `#e85d3d` (`--primary: oklch(0.59 0.19 35)` in `globals.css`) |
| Background | `#faf7f2` warm white (`oklch(0.978 0.006 80)`) |
| Verified badge green | `#1f7a45` |
| Sans font | Sora (`--font-sans`) |
| Serif accent font | Newsreader (`--font-serif`, italic accents) — note: this pairing was originally listed under candidate 1b, not 1a, but is what actually shipped |
| Data/label font | **IBM Plex Mono** (`--font-mono`) — times, reason code chips, scores, IDs |
| Image placeholders | CSS `repeating-linear-gradient` stripes until real photos land (Phase 6 via Unsplash API) |

Candidates 1b (`#c14a2e` coral) and 1c (`#ffb26b` amber, dark bg) were not used anywhere in the shipped app — kept only for historical reference in the archived canvas file.

## Key UI patterns (shipped)

- **Reason code chips** — pill-shaped, color-coded by type, IBM Plex Mono text
- **Verification badge** — `✓ hours verified` / `✓ all stops verified` in `#1f7a45` green
- **Trend panel** — horizontal bar chart, score labels, disclaimer "sponsored and repeated content filtered out"
- **Map split view** — itinerary list left/bottom, map right/top
- **Wordmark** — TRAIVEL with "AI" in a distinct weight or color

## Historical reference

The Phase 0 side-by-side comparison canvas lives at `design/TRAIVEL App Outlook.dc.html` (moved from repo root). It still contains all 3 original candidates for historical/portfolio reference but is not used by any code or build step.
