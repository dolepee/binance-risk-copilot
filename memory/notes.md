# Memory Notes

- March 7, 2026: created a separate Next.js app at `/home/qdee/binance-risk-copilot` by reusing the scaffold only, keeping the live website repo untouched.
- Added deterministic Binance Futures risk analysis in `src/lib/risk-copilot.ts`.
- Built the core workbench UI in `src/components/risk-copilot-workbench.tsx`.
- Replaced Mission Control branding with Binance Risk Copilot in `src/components/app-shell.tsx` and `src/app/layout.tsx`.
- Added a Binance-style visual system and workbench styles in `src/app/globals.css`.
- Added `/demo` with a short judge / recording walkthrough in `src/app/demo/page.tsx`.
- Upgraded the verdict panel into a chat-style OpenClaw assistant review.
- Added one-click demo scenario buttons for `safe`, `caution`, and `danger`.
- Removed stale Mission Control routes and unused API endpoints from the isolated app surface.
- Verified the app with `npm run lint` and `npm run build`; both pass.
- Published the repo to `https://github.com/dolepee/binance-risk-copilot` via the authenticated OpenClaw VPS GitHub session.
