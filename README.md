# TITAN PROTOCOL

Titan Protocol is a full-stack life gamification system that turns real-world habits, goals, and discipline into XP, dynamic levels, and fixed milestone-based ranks.

Built with:
- FastAPI (Backend API)
- Supabase PostgreSQL (Database)
- Next.js 16 + TypeScript (Frontend)
- Tailwind CSS (Neon / Cyber UI)

---

## 🚀 Vision

Titan Protocol transforms life into a structured progression engine:

- Earn XP for completing quests
- Level up dynamically
- Unlock fixed ranks at milestone levels
- Track habits, workouts, deep work sessions, and long-term goals
- Expand into gym logging, meditation tracking, and AI coaching

This is not a to-do app.

This is a life operating system.

---

## 🏗 Architecture

### Monorepo structure

```text
titan-protocol/
  apps/
    api/        # FastAPI backend
    web/        # Next.js frontend
  supabase/     # SQL/schema notes (optional)
  docs/         # Documentation (optional)
  infra/        # Deployment/infra (optional)
```

---

## ⚙ Backend (FastAPI)

Location:
apps/api

### Features

- XP Ledger System
- Dynamic Level Curve
- Fixed Rank Milestones
- Quest System
  - Main
  - Side
  - Daily
- Quest Completion → Automatic XP Award
- PostgreSQL via asyncpg
- Supabase-hosted database

### Run Backend Locally

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API Docs:
http://127.0.0.1:8000/docs

---

## 🗄 Database (Supabase)

Database: PostgreSQL (Supabase)

Required Environment Variables (.env):

SUPABASE_URL=your_project_url  
SUPABASE_ANON_KEY=your_publishable_key  
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres  

Database includes:

- xp_ledger
- ranks
- quests
- enum quest_type (main, side, daily)

---

## 🎨 Frontend (Next.js 16)

Location:
apps/web

### Tech

- App Router
- TypeScript
- Tailwind CSS
- Neon / HUD-inspired UI

### Features

- Live XP Progress Bar
- Rank + Level Display
- Quest Board (Main / Side / Daily)
- Create Quest Modal
- Complete Quest → Instant XP Update

### Run Frontend

```bash
cd apps/web
npm install
npm run dev
```

Optional AI meal estimation setup (`apps/web/.env.local`):

```bash
OPENAI_API_KEY=your_openai_api_key
```

Frontend:
http://localhost:3000

---

## 📈 Progression System

Leveling:
- Dynamic XP curve
- XP required increases per level

Ranks:
- Fixed milestone unlocks
- Example:
  - Initiate
  - Operator
  - Specialist
  - Vanguard
  - Sentinel
  - Titan

XP is calculated from ledger entries, not stored statically.

---

## 🔮 Roadmap

Upcoming systems:

- Daily reset + streak tracking
- Gym workout logging
- Pomodoro focus tracker
- Meditation tracker
- AI productivity coach
- Mobile deployment
- User authentication (Supabase Auth)

---

## 🛠 Development Workflow

Push to GitHub:

```bash
git add .
git commit -m "Your message"
git push
```

Never commit:
- .env
- .venv
- node_modules
- .next

---

## 🧠 Philosophy

Titan Protocol is built around structured growth.

Discipline becomes measurable.
Consistency becomes visible.
Progress becomes undeniable.

You don't track life.

You level it.

---

## 📜 License

Private project (for now).
