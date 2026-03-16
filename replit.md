# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Application

**PlanifPro** - Application de planification de flotte et RH avec interface glisser-déposer.
- Gestion des clients, employés et véhicules (pick-ups)
- Plans de travail avec drag-and-drop (dnd-kit)
- Import de données depuis fichiers Excel (xlsx)
- Rendu visuel imprimable des plans
- Interface en français

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

## PlanifPro — Architecture Clé

### Encodage des assignments (plans)

Les assignments (table `assignments`) encodent à la fois les métadonnées de blocs clients et les ressources affectées :

- **Position `bi×200`** : ligne de métadonnées du bloc `bi`. Notes = JSON `{sd, st, ed, et}` (startDate, startTime, endDate, endTime au format "YYYY-MM-DD" / "HH:MM")
- **Positions `bi×200+1..100`** : IDs d'employés du bloc `bi`
- **Positions `bi×200+101..200`** : IDs de véhicules du bloc `bi`
- Chargement : `Math.floor(pos/200)` = index de bloc, `pos % 200` = position locale (0 = méta)

### Logique de disponibilité (`/api/plans/busy-resources`)

Le endpoint accepte :
- `date` : date du plan en cours d'édition (YYYY-MM-DD)
- `excludePlanId` : ID du plan courant à exclure
- `clientNow` : date+heure locale du navigateur ("YYYY-MM-DDTHH:MM") — **obligatoire pour éviter les erreurs de fuseau horaire**

Algorithme :
1. Charge TOUS les plans et TOUS leurs assignments (sauf `excludePlanId`)
2. Parse les lignes de métadonnées (position % 200 === 0) pour extraire `{sd, ed, et}`
3. Sélectionne les blocs dont `startDate ≤ date ≤ endDate` (chevauchement de date)
4. Fallback sans métadonnées : utilise `plan.date = date` comme critère
5. Pour chaque bloc actif : compare `endTime > nowTime` (heure locale fournie par le client)

### Gestion des dates — piège timezone JS

`new Date("YYYY-MM-DD")` est parsé comme **minuit UTC** → décalage de -1 jour en heure locale (ex: France UTC+1).

**Pattern correct pour affichage** :
```typescript
new Date("YYYY-MM-DD" + "T12:00:00")  // midi local, sans décalage UTC
```

**Pattern correct pour la date du jour** :
```typescript
const now = new Date();
`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
```

Ne jamais utiliser `new Date().toISOString().split('T')[0]` pour la date locale (donne la date UTC).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
