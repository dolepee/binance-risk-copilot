# Binance Risk Copilot

OpenClaw-powered Binance Futures risk review MVP.

This project is a focused demo app for the Binance build challenge. It does not try to be a full trading terminal. The product goal is narrower: review a planned Futures trade before execution, explain the risk in plain English, and suggest a safer setup when the trade is too aggressive.

## Live Demo
- GitHub repo: `https://github.com/dolepee/binance-risk-copilot`
- Public demo URL: `https://dolepee.github.io/binance-risk-copilot/`
- The VPS app remains internal; the raw VPS IP is not used as the public demo link.

## What It Does
- Reviews a proposed Binance Futures trade against account-level guardrails
- Scores the setup as:
  - within policy
  - needs adjustment
  - unsafe to place
- Explains the main reasons for the verdict
- Suggests a safer leverage, size, and stop-loss setup
- Models a BTC-led shock scenario and estimates liquidation pressure

## Core Features
- `Trade Check`
  - leverage policy
  - risk-to-stop budget
  - daily drawdown headroom
- `Exposure Guard`
  - same-bucket correlated exposure across the existing book
- `Shock Test`
  - BTC shock mapped into symbol beta and portfolio impact
- `Assistant Review`
  - chat-style OpenClaw verdict with visible warnings and recommendations
- `Demo Scenarios`
  - one-click safe / caution / danger states for screen recording

## Routes
- `/`
  - main risk workbench
- `/demo`
  - short judge-facing recording script and walkthrough

## Stack
- Next.js App Router
- React 19
- TypeScript
- deterministic local risk engine

## Local Run
1. Install dependencies:
   - `npm install`
2. Start the dev server:
   - `npm run dev`
3. Open:
   - `http://localhost:3000`

## Checks
- `npm run lint`
- `npm run build`
- `npm run build:pages`

All three pass in the current state.

## Project Structure
- `src/lib/risk-copilot.ts`
  - deterministic risk engine and scenario math
- `src/components/risk-copilot-workbench.tsx`
  - main UI, assistant flow, and one-click demo states
- `src/components/app-shell.tsx`
  - top-level shell and branding
- `src/app/demo/page.tsx`
  - recording notes for the submission demo
- `src/app/globals.css`
  - visual system and workbench styling

## Current Demo Scenario Calibration
- `safe` -> score `90`
- `caution` -> score `59`
- `danger` -> score `27`

## Current Constraints
- No live Binance account integration yet
- No order execution
- No real-time market feed
- Risk model is deterministic and demo-oriented, not an exchange-grade risk engine

## Recommended Next Steps
- Add recording mode to hide form clutter during capture
- Optionally wire read-only live Binance market data
- Add a custom domain later if you want a shorter branded URL than GitHub Pages
- Package a short demo video using the existing `/demo` script
