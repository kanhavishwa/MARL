# Traffic RL Simulation — Local Setup

Browser-based multi-agent traffic simulation using tabular Q-learning.

## Requirements

- Node.js 20+ OR Bun 1.1+
- npm / bun / pnpm

## Install

```bash
npm install
# or
bun install
```

## Run dev server

```bash
npm run dev
# open http://localhost:5173
```

## Production build

```bash
npm run build
npm run start    # serves the built app
```

## Tech stack

- React 19 + JavaScript / JSX
- TanStack Start v1 (SSR + file-based routing)
- Vite 7
- Tailwind CSS v4
- Supabase client (Lovable Cloud)

## Project structure

- `src/routes/` → pages (file-based routing)
- `src/components/` → React components (SimulationPanel, IntersectionCanvas, ui/)
- `src/lib/traffic/` → simulation engine + Q-learning agent
- `src/integrations/supabase/` → backend client
- `src/styles.css` → Tailwind v4 + design tokens

## Notes

- `.env` is included with the public Supabase URL + anon key (safe to share).
- Do NOT edit `src/integrations/supabase/types.js` or `src/routeTree.gen.ts` (auto-generated).
