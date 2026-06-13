# CalendarInsights

Analizá tu Google Calendar y obtené reportes de en qué invertís tu tiempo.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Auth.js v5 (Google OAuth) · Drizzle ORM + Postgres · Recharts.

> ⚠️ Este proyecto usa un fork de Next.js 16 con cambios de convención: el archivo
> de middleware se llama **`proxy.ts`** (no `middleware.ts`), `cookies()`/`params`
> son async, y Turbopack es el bundler por defecto. Ver `node_modules/next/dist/docs/`.

## Estado: Milestone 1

Login con Google → sync de eventos a la DB → categorización por reglas → **reporte semanal**
(distribución de tiempo por categoría). Forecast, reportes mes/año/histórico y bloques
manuales (sueño/trabajo) llegan en milestones siguientes.

## Setup

1. **Dependencias** (ya instaladas): `npm install`. Recomendado **Node 22 LTS**
   (el `package.json` pide `^20.19 || ^22.13 || >=24`).

2. **Variables de entorno** — copiá `.env.example` a `.env.local` y completá:
   - `DATABASE_URL` — Postgres (Vercel Postgres / Neon).
   - `AUTH_SECRET` — `openssl rand -base64 32`.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — OAuth client (ver abajo).
   - `CRON_SECRET` — opcional, protege `GET /api/sync` (cron de Vercel).

3. **Google Cloud Console**
   - Habilitá **Google Calendar API**.
   - Creá un **OAuth client ID** tipo *Web application*.
   - Redirect URI: `http://localhost:3000/api/auth/callback/google`
     (y la equivalente de producción al deployar).
   - Pegá client id/secret en `.env.local`.

4. **Migrar la DB**
   ```bash
   npm run db:generate   # genera migraciones desde src/db/schema.ts
   npm run db:migrate    # las aplica
   # o, en desarrollo: npm run db:push
   ```

5. **Correr**
   ```bash
   npm run dev
   ```
   Abrí http://localhost:3000 → te redirige a `/login` → *Entrar con Google*
   (el consent debe pedir acceso a Calendar) → en `/dashboard` tocá **Sincronizar**.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `start` | Build / serve de producción |
| `npm run lint` | ESLint |
| `npm run db:generate` | Genera migraciones SQL |
| `npm run db:migrate` | Aplica migraciones |
| `npm run db:push` | Sincroniza schema directo (dev) |
| `npm run db:studio` | Drizzle Studio (inspeccionar datos) |

## Arquitectura

```
src/
  auth.ts                  Config Auth.js v5 (Google, scope Calendar, refresh token)
  proxy.ts                 Gate optimista de /dashboard (cookie de sesión)
  db/
    schema.ts              Tablas: auth + categories, rules, calendars, events, manualBlockTemplates
    index.ts               Cliente Drizzle (postgres-js)
  lib/
    google/client.ts       Refresh de access_token de Google
    google/sync.ts         Sync incremental (syncToken) → upsert de eventos
    categorize.ts          Aplica reglas (híbrido: auto + override manual)
    reports.ts             Agregación semanal por categoría (timezone-aware)
  app/
    lib/dal.ts             verifySession() — auth check cerca de los datos
    login/page.tsx         Login con Google
    api/auth/[...nextauth] Handlers de Auth.js
    api/sync/route.ts      POST (sync del usuario) · GET (cron, todos)
    (app)/dashboard/       Reporte semanal (server) + WeekReport / SyncButton (client)
```

### Categorización (híbrida)

Las **reglas** (`rule`) mapean eventos a categorías por: id de calendario, texto contenido
en el título, o regex. Mayor `priority` gana. Una categoría asignada a mano
(`categorySource = 'manual'`) nunca se pisa por reglas.
