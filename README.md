# Health AI App (MVP Monorepo)

Personal health tracking MVP for 1-3 users with:
- blood test tracking
- medications
- weight/lifestyle-ready data model
- document upload metadata
- AI explanations of lab data

This is a **web-first** monorepo using `pnpm` workspaces.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend/BFF: NestJS-style TypeScript API (modular, DTO validation)
- Auth/DB/Storage: Supabase
- AI: OpenAI API (backend-only)
- Package manager: pnpm only

## Monorepo Structure

```text
health-ai-app/
  apps/
    frontend/
    backend/
  packages/
    shared/
  supabase/
    migrations/
  package.json
  pnpm-workspace.yaml
  README.md
  .gitignore
```

## Prerequisites

- Node.js 20+
- pnpm 9+ (or newer)
- Supabase project
- OpenAI API key

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure frontend env:

```bash
cp apps/frontend/.env.example apps/frontend/.env
```

Set values in `apps/frontend/.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` (example: `http://localhost:4000`)

3. Configure backend env:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Set values in `apps/backend/.env`:
- `PORT` (default 4000)
- `FRONTEND_ORIGIN` (example: `http://localhost:5173`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (example: `gpt-4.1-mini`)

4. Run Supabase SQL migration:

- Open Supabase SQL editor
- Run: `supabase/migrations/0001_init.sql`

5. Start apps:

```bash
pnpm dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Workspace Commands

- `pnpm dev`
- `pnpm dev:frontend`
- `pnpm dev:backend`
- `pnpm build`
- `pnpm lint`

## Main Flows Implemented

1. User logs in or signs up (Supabase Auth).
2. User adds lab results.
3. User views lab results on dashboard.
4. User selects results and clicks **Explain my results**.
5. Frontend sends selected labs to backend `POST /ai/analyze-labs` with bearer token.
6. Backend validates input, builds a safe prompt, calls OpenAI, returns explanation + disclaimer.
7. Backend attempts to store the insight in `ai_insights`.

## Safety Note

All AI outputs include:

> "This information is for educational purposes only and is not a medical diagnosis."

The app is not a clinical decision tool.

## Supabase Notes

- Auth is handled by Supabase.
- `documents` table stores metadata only.
- Uploaded files should go to Supabase Storage bucket `documents`.
- Row Level Security starter policies are included in SQL.

## Learning-Oriented Scope

This repository is intentionally minimal and readable:
- no microservices
- no Docker requirement
- no AWS dependencies
- easy to extend to PWA/mobile later