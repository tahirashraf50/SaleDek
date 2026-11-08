# SaleDek — Omnichannel Complaint + Sales SaaS

HubSpot-style multi-tenant CRM with a WhatsApp Web–like Omnichannel Inbox, Service Hub, and Sales Hub.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL
- Auth.js (credentials)

## Quick start

```bash
# 1. Start Postgres (port 5434)
docker compose up -d

# 2. Install & migrate
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed

# 3. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → marketing site

### Demo login

- **Platform super admin:** `super@pulsecrm.com` / `demo1234` → `/admin`
- **Tenant admin:** `admin@demo.com` / `demo1234` → `/inbox`
- **Agent:** `agent@demo.com` / `demo1234`

### Public sites

- Marketing + SaaS packages: `/` · `/pricing`
- Tenant product shop: `/shop/demo-telecom`
- Tenant complaint portal: `/portal/demo-telecom`

## Main areas

| Route | Purpose |
|-------|---------|
| `/inbox` | Omnichannel workspace (WhatsApp / Email / Call / Portal) |
| `/dashboard` | KPIs & queues |
| `/customers` | Customer 360 |
| `/tickets` | Service Hub (list + kanban, bulk actions, saved views) |
| `/sales/*` | Deals, orders, products |
| `/reports/*` | Service, sales & inbox channel analytics |
| `/settings/channels` | Channel connectors (UI / webhook) |
| `/settings/knowledge` | Internal knowledge base |
| `/settings/*` | Users, departments, SLA, automations |

### Inbound webhook (optional)

1. Settings → Channels → set mode to **WEBHOOK**, enable, save (copy secret)
2. `POST /api/webhooks/inbound/{orgSlug}/{channel}` with header `x-webhook-secret`
3. Body: `{ "externalRef": "0300...", "body": "hello", "customerName": "Ali" }`

### Integrations (sandbox)

- **WhatsApp / Email:** Settings → Channels — mock by default; paste Meta token / SMTP to go live
- **Simulate inbound:** same page → Inject into Inbox
- **Payments:** Order detail → Verify with `JC-OK-123` (JazzCash) or 8+ char bank ref

### Inbox actions

- **Make Complaint** — opens complaint form (customer prefilled from thread)
- **Make Sale Lead** — opens sale form with products + payment method
- **Call** — Call Intake form only (no Asterisk)

### Public customer portal

- Demo: [http://localhost:3000/portal/demo-telecom](http://localhost:3000/portal/demo-telecom)
- Submit complaint + track by ticket # and phone/email (no login)

## Scripts

- `npm run dev` — development server
- `npm run build` / `npm start` — production
- `npm run db:seed` — demo data
- `npm run db:migrate` — migrations
