# Kedros

## Overview

Kedros is a Next.js app: the public marketing site plus a client login/billing portal backed by Postgres (via Prisma) and Stripe.

## Running locally

1. Copy `.env.example` to `.env` and fill in real values (a local Postgres `DATABASE_URL`, a generated `NEXTAUTH_SECRET`, and Stripe **test-mode** keys).
2. `npm install`
3. `npx prisma migrate dev` — creates the database schema.
4. `npm run seed` — creates your admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.
5. `npm run dev` — starts the app on port 5000.
6. In a separate terminal: `stripe listen --forward-to localhost:5000/api/webhooks/stripe` — forwards Stripe test events locally, and prints the `whsec_...` value to put in `STRIPE_WEBHOOK_SECRET`.

## How it works

- `/` — public landing page.
- `/login` — email + password login (no public signup; accounts are created by the admin).
- `/admin` — admin-only: create client accounts, each with its own one-time setup fee and monthly subscription amount.
- `/account` — client-only: shows setup-fee and subscription status, with "Pay setup fee" / "Subscribe monthly" buttons that start a Stripe Checkout session.
- `app/api/webhooks/stripe` — Stripe webhook that marks the setup fee paid and keeps subscription status in sync.

## Production (Railway)

- Attach a Postgres addon to the Railway service — it auto-injects `DATABASE_URL`.
- Set `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (the production URL), `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` in the Railway service's Variables tab.
- `npm run build` runs `prisma generate && next build`; `npm run start` runs `prisma migrate deploy && next start` (safe to run on every boot — no-ops once migrations are applied).
- Register the production webhook endpoint (`https://<your-domain>/api/webhooks/stripe`) in the Stripe dashboard once deployed, and put the resulting signing secret in `STRIPE_WEBHOOK_SECRET`.
- Run `npm run seed` once against production (e.g. via `railway run npm run seed` with `ADMIN_EMAIL`/`ADMIN_PASSWORD` set) to create the first admin account.
