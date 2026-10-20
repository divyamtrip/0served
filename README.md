# 0served (`oserved.com`)

An independent research, market intelligence, competitive intelligence, and strategic analysis publication.

> **Positioning:** *Independent research. Structured intelligence. Clearer decisions.*

---

## Brand Principles & Editorial Standard

- **Evidence over speculation**: We prioritize balance sheets, regulatory filings, and empirical operational telemetry over market consensus and marketing narratives.
- **Clarity over complexity**: Analytical depth should illuminate reality, not obfuscate it behind dense jargon or convoluted models.
- **Substance over promotional language**: We do not publish sponsored content, vendor-funded benchmarks, or unverified claims.
- **Analytical depth over superficial summaries**: Every investigation is designed to provide structural insight that withstands rigorous scrutiny by decision-makers.
- **Independence and intellectual rigor**: Our work is uncompromised by advisory engagements, investment banking relationships, or editorial conflicts.

---

## System Architecture

0served is built on a high-performance, lightweight, production-oriented stack:

- **Framework**: [Astro 7](https://astro.build) with `@astrojs/node` standalone server adapter.
- **Database**: Persistent relational database powered by Node.js native `DatabaseSync` (`node:sqlite`) with Write-Ahead Logging (WAL), foreign key enforcement, and automated migrations. Also includes complete PostgreSQL / Supabase migration schema (`supabase/schema.sql`).
- **Authentication**: Native server-side authentication using `crypto.scrypt` password hashing (16-byte cryptographically secure random salt, cost factor N=16384), 32-byte secure session tokens, and HTTP-only, SameSite=Lax cookies.
- **Security & Access Control**: Strict server-side route guards via Astro middleware. All administrative routes (`/admin/*`) and API endpoints (`/api/admin/*`) reject unauthorized requests. Draft reports return HTTP 404 to unauthenticated visitors.
- **Rate Limiting**: Sliding-window rate limiter protecting login and contact endpoints against brute-force attacks and abuse.
- **Content System**: Dynamic publication engine with live Markdown editor, split-screen preview, automatic reading time calculation, Table of Contents extraction, responsive data tables, callouts, and footnote citations (`[^1]`).
- **Media Management**: Secure upload pipeline supporting PNG, JPEG, WebP, SVG, AVIF, and PDF dossiers with MIME-type validation, size restrictions, and safe UUID storage keys.
- **SEO & Discoverability**: Semantic HTML, Open Graph tags, Twitter cards, JSON-LD Schema.org (`ScholarlyArticle` / `Organization`), dynamic RSS feed (`/rss.xml`), sitemap (`/sitemap-index.xml`), and robots.txt.

---

## Directory Layout

```
0served/
├── data/                       # Persistent SQLite database storage (WAL mode)
├── docs/
│   └── OWNER_MANUAL.md         # Complete editorial desk operation guide
├── public/
│   ├── favicon.svg             # Exact "0served" brand vector mark
│   └── uploads/                # Persistent media uploads & PDF dossiers
├── scripts/
│   └── provision-owner.mjs     # Secure CLI owner account provisioning
├── src/
│   ├── components/             # BaseHead, Header, Footer
│   ├── layouts/                # Public Layout and Private AdminLayout
│   ├── lib/
│   │   ├── auth.ts             # Password hashing, sessions, cookies, rate limits
│   │   ├── db.ts               # Relational database engine, schema, and queries
│   │   └── types.ts            # Core TypeScript data contracts
│   ├── middleware.ts           # Route guard protecting /admin and /api/admin
│   ├── pages/
│   │   ├── admin/              # Private administration portal
│   │   │   ├── categories/     # Research domain management
│   │   │   ├── inquiries/      # Inbound desk transmissions
│   │   │   ├── media/          # Exhibit and PDF asset library
│   │   │   ├── reports/        # Full report manager and rich editor
│   │   │   ├── settings/       # Brand settings and featured report selector
│   │   │   ├── index.astro     # Editorial desk telemetry dashboard
│   │   │   └── login.astro     # Secure authentication portal
│   │   ├── api/                # Protected admin & public APIs
│   │   ├── research/           # Publications listing & [slug] report view
│   │   ├── about.astro         # About 0served, mission, & principles
│   │   ├── archive.astro       # Searchable, filterable chronological archive
│   │   ├── contact.astro       # Secure contact form with honeypot & validation
│   │   ├── index.astro         # Dynamic homepage (pulls from real database)
│   │   ├── markets.astro       # Covered research domains
│   │   ├── robots.txt.ts       # Dynamic robots.txt
│   │   └── rss.xml.js          # Dynamic RSS publication feed
│   └── styles/
│       └── global.css          # Editorial minimal design system
├── supabase/
│   └── schema.sql              # PostgreSQL / Supabase migration schema + RLS
├── test/
│   └── publishing-and-auth.test.mjs # Automated test suite (node:test)
├── Dockerfile                  # Production container build
├── docker-compose.yml          # Container orchestration with volumes
├── package.json
└── tsconfig.json
```

---

## Getting Started

### 1. Prerequisites
- Node.js 22.12.0 or later (Node 24 recommended).
- npm 10 or later.

### 2. Installation
```bash
git clone https://github.com/divyamtrip/0served.git
cd 0served
npm install
```

### 3. Provision Owner Account
Public registration is strictly disabled. Provision your owner credentials using the CLI tool:
```bash
npm run owner:create -- --email="owner@oserved.com" --password="YourSecurePassword123!"
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:4321](http://localhost:4321) to view the public publication.  
Open [http://localhost:4321/admin](http://localhost:4321/admin) to log into the editorial desk.

### 5. Run Automated Tests
```bash
npm test
```
Executes the native test suite verifying database migrations, cryptographic hashing, session security, rate limiting, draft privacy isolation, and category referential integrity.

---

## Production Deployment

### Option A: Standalone Node.js (Render, Railway, VPS, Fly.io)

1. Build the production application:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   node dist/server/entry.mjs
   ```
   *(Ensure the `data/` and `public/uploads/` directories are mapped to a persistent disk or volume).*

### Option B: Docker / Docker Compose

1. Build and run using Docker Compose:
   ```bash
   docker compose up -d --build
   ```
2. Provision the owner account inside the container:
   ```bash
   docker compose exec app node scripts/provision-owner.mjs --email="owner@oserved.com" --password="YourPassword"
   ```

### Option C: Managed PostgreSQL / Supabase Deployment

If deploying with Supabase or managed PostgreSQL:
1. Run `supabase/schema.sql` in the Supabase SQL Editor to generate all tables, indices, and Row Level Security policies.
2. Provide `DATABASE_URL` or `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your environment.

---

## Testing & Quality Verification

All critical workflows have been implemented and verified:

| Test Domain | Coverage | Verification Status |
| :--- | :--- | :--- |
| **Authentication** | scrypt password hashing, session tokens, cookie security | Verified (HTTP 200 / Set-Cookie) |
| **Access Control** | Middleware protection on `/admin` & `/api/admin` | Verified (302 to login / 401 on API) |
| **Draft Privacy** | Public access to unpublished drafts | Verified (Strict HTTP 404) |
| **Preview Mode** | Authenticated owner preview of drafts | Verified (HTTP 200 with preview banner) |
| **Publishing Flow** | Draft &rarr; Publish &rarr; Homepage & Archive visibility | Verified (Instant live reflection) |
| **Slug Redirects** | Changing report slug creates 301 redirect | Verified (Preserves incoming links) |
| **Referential Integrity** | Deleting categories with assigned reports | Verified (Blocked with safe error) |
| **Rate Limiting** | Brute-force protection on auth and contact | Verified (HTTP 429 Too Many Requests) |
| **Public UX & SEO** | Homepage, Research, Markets, Archive, About, RSS, Robots | Verified (All 200 OK with real DB data) |
