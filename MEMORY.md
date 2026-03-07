# Binance Risk Copilot Notes

This repository now hosts an isolated Binance Risk Copilot MVP built from the earlier Mission Control scaffold without touching the live website repo.

## Current Product State
- Assistant-first Binance Futures risk review demo for contest submission use.
- Main routes:
  - `/` workbench
  - `/demo` recording notes / judge script
- Public URL:
  - `http://16.16.120.1/binance-risk-copilot`
- Local build status:
  - `npm run lint` passes
  - `npm run build` passes

## Core MVP Shipped
- Deterministic risk engine in `src/lib/risk-copilot.ts`
  - leverage guard
  - risk-to-stop checks
  - correlated exposure checks
  - daily drawdown headroom
  - BTC-led shock test
  - liquidation buffer / safer setup output
- Interactive workbench in `src/components/risk-copilot-workbench.tsx`
- Binance-focused shell / branding in `src/components/app-shell.tsx`
- Demo route in `src/app/demo/page.tsx`
- Gold-accent Binance-style theme and workbench styling in `src/app/globals.css`

## UX Upgrades Added
- Plain-English assistant verdict
- Chat-style OpenClaw response flow
- Safer setup recommendation block
- One-click demo scenarios:
  - safe
  - caution
  - danger

## Important Implementation Notes
- Work was moved into `/home/qdee/binance-risk-copilot` so `/home/qdee/openclaw-mission-control` stays untouched.
- Old Mission Control page routes and stale API routes were removed from the isolated app surface.
- Public GitHub repo: `https://github.com/dolepee/binance-risk-copilot`
- Deployed publicly under the existing VPS at `/binance-risk-copilot`, backed by a separate `binance-risk-copilot.service` on port `3002`.
- The current scenario calibration is:
  - `safe` -> score `90`
  - `caution` -> score `59`
  - `danger` -> score `27`

## Recommended Next Steps
- Add recording mode to hide form noise during demo capture.
- Optionally wire live read-only Binance market data for stronger realism.
- Push this app to a public GitHub repo for the contest submission.
