# PitchNest production deployment guide

This guide deploys the React/Vite frontend to Cloudflare Workers, the Express/WebSocket
backend to Render, and PostgreSQL plus object storage to Supabase. Keep staging
and production in separate projects and never reuse their secrets.

## 1. Prerequisites

- Node.js 24 LTS locally and in CI.
- A Supabase project, a Render web service, and a Cloudflare Workers project
  connected to this GitHub repository.
- An Azure OpenAI deployment or OpenAI API key.
- Azure Speech credentials for live transcription and voice.
- A verified Resend sender domain before sending production email.
- Flutterwave secrets only if self-service billing will be enabled.

Copy the example environment files; never commit a real `.env` file.

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

## 2. Apply the database migrations

Take a restorable Supabase backup first. For a new project, run
`backend/migrations/0000_complete_fresh_setup.sql`, then every numbered SQL file
that exists after it in ascending order through
`0030_auth_and_erasure_hardening.sql`. There is intentionally no `0007` file.

For an existing project, follow `backend/migrations/README.md`. Do not mark old
migrations as applied merely from their filenames; verify the target objects.
Run staging first, then production.

Migration `0030` is mandatory for the matching backend. The manual
`REVOKE/GRANT/ALTER FUNCTION grant_pro_access` statements secure one function,
but they do not install JWT revocation, atomic verification/reset, capacity-safe
organization enrollment, the safe session-list view, recoverable email leases,
billing invariants, or erasure-safe foreign keys.

After `0030`, verify the security-definer functions are service-role-only:

```sql
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.proacl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'grant_pro_access',
    'claim_weekly_session_slot',
    'claim_trial_email',
    'consume_email_verification',
    'consume_password_reset',
    'enroll_user_in_organization'
  );
```

Confirm that `pitchnest-media` is private and `pitchnest-avatars` is public.
The optional `SUPABASE_PUBLIC_MEDIA_BUCKET` may point to the public avatar
bucket, but private decks and recordings must stay in `pitchnest-media`.

## 3. Configure and deploy the backend

The repository `render.yaml` is the deployment blueprint. It uses `npm ci`,
starts the server with `npm start`, checks `/health`, and pins Node 24.

Required production values:

| Variable | Purpose |
|---|---|
| `NODE_ENV=production` | Enables production security behavior. |
| `SUPABASE_URL` | Supabase project origin, without `/rest/v1`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only service key. Never expose it to Vite. |
| `JWT_SECRET` | At least 32 random bytes; use a generated secret. |
| `ALLOWED_ORIGIN` | Exact HTTPS frontend origin, with no path. |
| `CLIENT_URL` | Exact HTTPS frontend origin used in email links. |
| `APP_BASE_URL` | Exact HTTPS frontend origin used for payment returns. |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Speech-to-text and text-to-speech. |

Choose one AI configuration:

```env
# Azure OpenAI v1 (recommended)
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com/openai/v1
AZURE_OPENAI_DEPLOYMENT=YOUR-DEPLOYMENT-NAME
AZURE_OPENAI_API_KEY=YOUR-KEY

# Or standard OpenAI
OPENAI_API_KEY=YOUR-KEY
```

`AZURE_OPENAI_API_VERSION=2024-10-21` is retained for classic Azure endpoints;
the `/openai/v1` endpoint does not require a dated API version. Deployment names
belong to your Azure resource; do not copy a model placeholder literally.

Optional production values include:

- `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_REPLY_TO` for verification, reset,
  and lifecycle mail.
- `FLW_SECRET_KEY`, `FLW_WEBHOOK_HASH`, catalog amounts, currency, and term days
  for Flutterwave. Billing remains unavailable when the secret or webhook hash
  is absent.
- `GOOGLE_CLIENT_ID` for Google sign-in.
- `RESEARCH_ENABLED=true` plus `TAVILY_API_KEY` or `SERPER_API_KEY` for market
  research.
- `CORS_EXTRA_ORIGINS` for exact additional HTTPS origins, comma-separated.
- `FEATURE_DISCOVER_ENGAGEMENT`, `FEATURE_COMMUNITY`, and
  `FEATURE_PITCH_ARENA`; keep these false until migrations and moderation are
  ready.

Do not set `SUPABASE_ANON_KEY` on the backend. The server does not use it.

### Trial lifecycle scheduler

The web process can run the sweep when `TRIAL_JOBS_ENABLED=true`, but a free
service may sleep. For reliable delivery, schedule `npm run job:trial-lifecycle`
at least every six hours in a worker or managed scheduler and set
`TRIAL_JOBS_ENABLED=false` on the web service. Never run the one-shot command
concurrently with an old backend that predates migration `0030`.

### Flutterwave webhook

Set the dashboard webhook URL to:

```text
https://YOUR-BACKEND.onrender.com/api/billing/webhook
```

Set the same secret hash in Flutterwave and `FLW_WEBHOOK_HASH`. Test a real
sandbox checkout and confirm the webhook settles the pending payment; the
browser return URL is not proof of payment.

## 4. Configure and deploy the frontend

Use `frontend` as the Cloudflare project root, `npm run build` as the build
command, and `dist` as the static assets directory, served as a single-page
application. Set these as build variables:

```env
VITE_API_URL=https://YOUR-BACKEND.onrender.com
VITE_WS_BACKEND_URL=wss://YOUR-BACKEND.onrender.com/ws
VITE_GOOGLE_CLIENT_ID=YOUR-GOOGLE-CLIENT-ID
```

Both backend URLs must be secure origins. Local development may use
`http://localhost:3000` and `ws://localhost:3000/ws`.

Not yet configured on Cloudflare: security response headers (a Content
Security Policy), forwarding `/sitemap.xml` to the backend, and forwarding
social-crawler requests for `/businesses/:slug` to the backend's
`/api/public/businesses/:slug/share-html` for link previews.

Set the frontend origin (for example
`https://pitchnest-live.etim0052.workers.dev`) as `ALLOWED_ORIGIN` and
`CLIENT_URL` on Render. Add any other origins individually through
`CORS_EXTRA_ORIGINS`; wildcard domains are not accepted.

## 5. Pre-deployment verification

Run from the repository root:

```powershell
Push-Location backend
npm ci
npm run lint
npm test
npm audit
Pop-Location

Push-Location frontend
npm ci
npm run lint
npm run build
npm audit
Pop-Location
```

Then verify:

- `/health` returns HTTP 200 without credentials.
- Signup, verification, login, refresh, logout, and password reset work.
- A revoked token fails both HTTP and WebSocket access.
- Decks and recordings require ownership and resolve through signed URLs.
- The live room connects to `/ws`, transcribes speech, and completes a report.
- Public share and Discover responses contain no deck text, transcript, recording
  key, email address, or private report action plan.
- Account deletion removes private objects before deleting the user row.
- A sandbox payment is granted only after the verified webhook.
- Feature flags remain off until a moderator account exists.

## 6. Rollout and rollback

Deploy the database migration before the matching backend and deploy the
frontend last. Watch authentication failures, WebSocket close codes, AI provider
latency, upload memory, email failures, and payment settlement errors during the
rollout.

Schema rollback is forward-fix by default. If a migration must be abandoned,
restore the pre-deployment snapshot rather than partially reversing constraints
against live data. Application rollback is safe only to a version compatible
with the already-applied schema.
