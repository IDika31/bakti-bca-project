# Development Environment Setup

This repo deploys to Vercel as a **monorepo with two services** (`frontend` Next.js + `backend` Hono/Bun), wired together by `vercel.json` rewrites. The guide below sets up a safe **development / preview** environment alongside production.

Best practice applied: **production and preview use separate Supabase projects**, so preview DB pushes, seeds, and broken migrations never touch real customer data.

---

## 1. Environments overview

| Environment | Git branch | Vercel target | Supabase project | Purpose |
|---|---|---|---|---|
| **Production** | `main` | Production | `bakti-prod` (existing) | Live site |
| **Preview** | `dev` + PR branches | Preview Deployment | `bakti-staging` (new) | Test features end-to-end before merge |
| **Local dev** | any branch | — (runs on your machine) | `bakti-staging` or local Postgres | Day-to-day coding |

Vercel auto-creates a Preview Deployment for every push to `dev` and every PR. Each preview gets its own `*.vercel.app` URL.

---

## 2. Create the staging Supabase project

Do this once.

1. Go to <https://supabase.com> → New project. Name it `bakti-staging` (or similar). Pick a region close to the production project (both projects ideally in the same cloud region for fast API calls).
2. Wait for provisioning, then open **Project Settings → Database**.
3. Copy two connection strings:
   - **Connection pooling** (port `6543`, `?pgbouncer=true`) → this is your staging `DATABASE_URL`.
   - **Direct connection** (port `5432`) → this is your staging `DIRECT_URL`.
4. Open **Project Settings → API** and copy:
   - Project URL → staging `SUPABASE_URL`
   - `service_role` secret key → staging `SUPABASE_SERVICE_ROLE_KEY`
   - `anon` public key → staging `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Storage → Create bucket** named `restaurant-assets` (must match `SUPABASE_STORAGE_BUCKET`). Set it public if menu images should be world-readable.
6. Generate a staging JWT secret:
   ```sh
   openssl rand -base64 32
   ```
   → staging `JWT_SECRET`.
7. Push the schema to staging:
   ```sh
   cd backend
   # use the staging DIRECT_URL temporarily
   bunx prisma db push
   bun run prisma/seed.ts
   ```

You now have an isolated staging database with seed data.

---

## 3. Vercel environment variables

In the Vercel dashboard: **Project Settings → Environment Variables**. Add each key to the correct environment(s). **Never commit secrets** — `vercel.env` and `.env` are git-ignored.

### Backend keys — set for **Production** (prod values) and **Preview + Development** (staging values)

| Key | Production value | Preview / Development value |
|---|---|---|
| `DATABASE_URL` | prod pooled conn | staging pooled conn |
| `DIRECT_URL` | prod direct conn | staging direct conn |
| `SUPABASE_URL` | prod project URL | staging project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service key | staging service key |
| `SUPABASE_STORAGE_BUCKET` | `restaurant-assets` | `restaurant-assets` |
| `JWT_SECRET` | prod secret | staging secret (generated above) |
| `JWT_EXPIRES_IN` | `24h` | `24h` |
| `APP_URL` | `https://[PROD_DOMAIN]` | leave **empty** — Vercel injects `VERCEL_URL` |
| `FRONTEND_URL` | `https://[PROD_DOMAIN]` | leave **empty** (CORS allows `*.vercel.app` automatically via `app.ts`) |
| `DEFAULT_EMAIL_DOMAIN` | `noreply.local` | `noreply.local` |

> `app.ts` already falls back to `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` when `APP_URL` is unset, and allows any `*.vercel.app` origin for CORS. So preview deploys work with zero URL config.

### Frontend keys — set for **all** environments (values differ per environment)

| Key | Production | Preview | Development |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://[PROD_DOMAIN]` | **empty** (same-origin via rewrites) | **empty** |
| `NEXT_PUBLIC_APP_URL` | `https://[PROD_DOMAIN]` | empty | empty |
| `NEXT_PUBLIC_SUPABASE_URL` | prod project URL | staging project URL | staging project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key | staging anon key | staging anon key |

> `NEXT_PUBLIC_*` vars are inlined at **build** time, so each environment must have its own value. On Vercel preview deploys, leave `NEXT_PUBLIC_API_URL` empty — `vercel.json` rewrites `/api/*` to the backend service, so the frontend calls same-origin and needs no base URL.

---

## 4. Link the `dev` branch to Preview

Vercel uses the git branch to pick the environment target:

- Pushes to **`main`** → **Production** deployment.
- Pushes to **`dev`** (and any PR branch) → **Preview** deployment.

Vercel creates a Preview Deployment for every branch/PR and a Production Deployment for `main` automatically once the repo is imported — no `vercel.json` flag needed (those are dashboard-only settings, not valid schema properties). To post deployment status back to GitHub PR comments, enable it in Project Settings → Git → "Comment on Pull Requests".

If the project is not yet imported:
1. Vercel dashboard → Add New → Project → import `IDika31/bakti-bca-project`.
2. Framework presets auto-detected from `vercel.json` (`frontend` = Next.js, `backend` = Hono service). Keep defaults.
3. Add the env vars from section 3.
4. First push to `main` deploys production; first push to `dev` deploys preview.

---

## 5. GitHub branch protection (best practice)

In GitHub: **repo Settings → Branches → Add branch protection rule** for `main`:

- Require a pull request before merging.
- Require approvals: at least **1**.
- Require status checks to pass before merging — enable **Vercel** check (appears after first PR deploy).
- Require branches to be up to date before merging.
- (Optional) Require linear history + require signed commits.

This forces every change to flow through `dev` → PR → review → `main`, so production only ever receives reviewed code that passed a Vercel preview build.

---

## 6. Local development

```sh
# Backend
cd backend
cp .env.example .env        # fill with STAGING values (safe to mutate)
bun install
bunx prisma generate
bun run dev                 # http://localhost:3001

# Frontend (new terminal)
cd frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:3001, staging Supabase
bun install
bun run dev                 # http://localhost:3000
```

Point local `.env` at the **staging** Supabase project, never production — `db push` / `seed` against prod would destroy or pollute live data.

Seed staging anytime:
```sh
cd backend && bun run prisma/seed.ts
```

---

## 7. Workflow summary

1. `git checkout dev && git pull`
2. Branch off: `git checkout -b feat/my-feature`
3. Code, commit, push: `git push -u origin feat/my-feature`
4. Open PR `feat/my-feature` → `dev` on GitHub. Vercel builds a preview deploy.
5. Test the preview URL. Iterate.
6. Merge into `dev`. Vercel rebuilds the `dev` preview.
7. Open PR `dev` → `main`. Review + Vercel production build check.
8. Merge → Vercel deploys **Production** using production env vars.

---

## 8. Secrets checklist

- [ ] `vercel.env`, `.env`, `.env.local` are git-ignored (already in `.gitignore`) — verify with `git ls-files | grep -i env` (should show only `*.env.example`).
- [ ] No real secrets committed — examples use `[PLACEHOLDER]` only.
- [ ] Vercel env vars set per environment (section 3).
- [ ] Staging Supabase project isolated from production.
- [ ] `main` branch protected (section 5).
