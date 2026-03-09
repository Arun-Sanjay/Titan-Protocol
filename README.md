# Titan Protocol

Titan Protocol is a local-first personal performance operating system built as a Next.js app with an optional Tauri desktop wrapper.

It is organized around four engines:
- Body
- Mind
- Money
- General

Each engine tracks daily tasks, completion, consistency, and score. The app also includes analytics, command center planning, habits, goals, journal, and focused utility tools.

## Current Status

This repository currently ships an actively used **web app + desktop app** under `apps/web`.

The previous backend/Supabase-oriented setup described in older docs is not the active runtime path for the current codebase.

## Repository Structure

```text
titan-protocol/
  apps/
    web/                  # Next.js app + Tauri desktop wrapper
      src-tauri/          # Tauri (Rust) desktop config and runtime
  packages/
    shared/               # Shared TS types/constants
  docs/
    archive/              # Archived notes from older iterations
  infra/                  # Placeholder infra files (currently minimal)
```

## Key Product Areas

- Core
  - Dashboard
  - Command Center
  - Analytics
- Engines
  - Body
  - Mind
  - Money
  - General
- Track
  - Habits
  - Journal
  - Goals
- Tools
  - Focus Timer
  - Workouts
  - Sleep Tracker
  - Weight Tracker
  - Nutrition
- Settings
  - Local JSON export/import backup
  - Onboarding replay

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript
- State/Data: Dexie (IndexedDB, local-first)
- UI: Tailwind CSS + custom HUD styles
- Charts: Recharts
- Motion: Framer Motion
- Desktop: Tauri 1.5 (Rust)
- PWA: `next-pwa`

## Data Model (Current)

Data is stored locally in IndexedDB via Dexie.

Major local tables include:
- Engine tasks/logs (Body, Mind, Money, General)
- Habits + habit logs
- Goals + goal tasks
- Journal entries
- Focus sessions
- Money transactions, loans, budgets
- Nutrition profile + meals
- Workout templates/sessions/sets
- Sleep entries
- Achievements and notifications

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- For desktop app builds: Rust + Cargo + Tauri system prerequisites

### Run Web App (Development)

```bash
cd apps/web
npm install
npm run dev
```

App URL:
- `http://localhost:3000`

### Run Desktop App (Tauri Development)

```bash
cd apps/web
npm install
npm run tauri:dev
```

### Build Web App

```bash
cd apps/web
npm run build
npm run start
```

### Build Desktop App Bundles

```bash
cd apps/web
npm run tauri:build
```

macOS DMG output is generated under:
- `apps/web/src-tauri/target/release/bundle/dmg/`

## Useful Scripts (`apps/web/package.json`)

- `npm run dev` - Next.js development server
- `npm run build` - production web build
- `npm run build:tauri` - static export for Tauri bundle flow
- `npm run start` - serve production web build
- `npm run lint` - ESLint
- `npm run tauri:dev` - run desktop app in dev mode
- `npm run tauri:build` - build desktop bundles

## Notes

- Auth pages and API route stubs in `apps/web/src/app` are currently disabled (`*.disabled`).
- `.github/workflows` and `infra/docker` currently contain placeholders.

## License

See [LICENSE](LICENSE).
