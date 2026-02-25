# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

ComEd Hourly Pricing App — a Next.js 16 PWA displaying real-time ComEd electricity prices with charts, best-time recommendations, and price alerts. See `README.md` for full architecture and API docs.

### Running services

Two processes are needed for full functionality:

- **Next.js dev server**: `npm run dev` (port 3000) — serves both the frontend and API routes.
- **Background worker**: `npm run worker` — fetches prices from ComEd API every 5 min and populates the SQLite database. Without it the dashboard has no historical data.

SQLite is embedded (no separate DB process). The database file is created automatically at `./data/comed.db`.

### Linting

`npm run lint` runs ESLint. There are pre-existing lint errors in the codebase (a `react-hooks/set-state-in-effect` error in `CurrentDate.tsx`).

### Environment variables

Copy `.env.example` to `.env.local`. The only required settings are `DATABASE_PATH` and `NEXT_PUBLIC_APP_URL` (defaults work for local dev). Email (`RESEND_API_KEY`) and push notification (`VAPID_*`) keys are optional — the app works without them.

### Gotchas

- The `data/` directory must exist before the worker or dev server can write the SQLite database. Create it with `mkdir -p data`.
- No automated test suite is configured in this project (no test framework or test scripts in `package.json`).
- The `canvas` npm package (a devDependency used by Recharts for SSR chart rendering) requires native build tools; it compiles during `npm install` and may warn on some systems, but is not blocking.
- The worker process (`npm run worker`) runs indefinitely via `node-cron`. It performs an initial price fetch on startup, then schedules fetches every 5 minutes.
