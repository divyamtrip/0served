-- ==========================================================================
-- 0served Production PostgreSQL / Supabase Schema
-- Target: Supabase / PostgreSQL 15+
-- ==========================================================================

-- 1. Users Table (for standalone or auth.users sync)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  salt text not null,
  role text not null default 'owner' check (role in ('owner', 'editor')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.users enable row level security;

-- 2. Sessions Table
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  user_agent text,
  ip_address text
);

create index if not exists idx_sessions_token_hash on public.sessions(token_hash);
create index if not exists idx_sessions_expires_at on public.sessions(expires_at);

alter table public.sessions enable row level security;

-- 3. Categories Table
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (char_length(name) between 1 and 100),
  slug text unique not null check (char_length(slug) between 1 and 120),
  description text not null default '',
  display_order integer not null default 0,
  is_active integer not null default 1 check (is_active in (0, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categories_slug on public.categories(slug);

alter table public.categories enable row level security;

-- 4. Reports Table
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 250),
  subtitle text not null default '',
  slug text unique not null check (char_length(slug) between 1 and 150),
  summary text not null check (char_length(summary) between 1 and 1500),
  content text not null,
  category_id uuid references public.categories(id) on delete set null,
  category_name text not null default 'General Research',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  author text not null default '0served Intelligence Unit',
  reading_time_minutes integer not null default 5,
  cover_image_url text not null default '',
  pdf_attachment_url text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  published_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reports_slug on public.reports(slug);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_published_at on public.reports(published_at desc nulls last);
create index if not exists idx_reports_category_id on public.reports(category_id);

alter table public.reports enable row level security;

-- 5. Slug Redirects Table
create table if not exists public.slug_redirects (
  old_slug text primary key,
  new_slug text not null,
  created_at timestamptz not null default now()
);

alter table public.slug_redirects enable row level security;

-- 6. Media Assets Table
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  original_name text not null,
  mime_type text not null,
  file_size bigint not null,
  storage_path text not null,
  public_url text not null,
  report_id uuid references public.reports(id) on delete set null,
  alt_text text not null default '',
  created_at timestamptz not null default now()
);

alter table public.media enable row level security;

-- 7. Site Settings Table
create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- 8. Contact Messages Table
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organization text not null default '',
  inquiry_type text not null default 'general',
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- 9. Audit Logs Table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- 10. Rate Limits Table
create table if not exists public.rate_limits (
  key text primary key,
  attempts integer not null default 1,
  reset_at bigint not null
);

alter table public.rate_limits enable row level security;

-- ==========================================================================
-- Row Level Security (RLS) Policies
-- Public read access for published reports and active categories only.
-- Administrative write operations restricted to authenticated owners.
-- ==========================================================================

-- Public Read Policies
create policy "Anyone can read published reports"
  on public.reports for select
  using (status = 'published');

create policy "Anyone can read active categories"
  on public.categories for select
  using (is_active = 1);

create policy "Anyone can read site settings"
  on public.site_settings for select
  using (true);

create policy "Anyone can read slug redirects"
  on public.slug_redirects for select
  using (true);

create policy "Anyone can read published media"
  on public.media for select
  using (true);

-- Public Write Policies (Contact Form)
create policy "Anyone can submit a contact inquiry"
  on public.contact_messages for insert
  with check (true);

-- Seed Categories
insert into public.categories (name, slug, description, display_order, is_active)
values
  ('Technology and software', 'technology-and-software', 'Compute infrastructure, capital intensity, software economics, and architectural shifts across enterprise technology systems.', 1, 1),
  ('Industry and manufacturing', 'industry-and-manufacturing', 'Physical industrial capacity, electrical interconnection queues, equipment supply chains, and manufacturing efficiency.', 2, 1),
  ('Markets and competitive dynamics', 'markets-and-competitive-dynamics', 'Capital concentration, competitive moats, pricing discipline, and systemic vulnerabilities across modern markets.', 3, 1),
  ('Business strategy and emerging developments', 'business-strategy-and-emerging-developments', 'Corporate incentives, balance sheet management, capital allocation tradeoffs, and institutional decision-making under uncertainty.', 4, 1)
on conflict (slug) do nothing;
