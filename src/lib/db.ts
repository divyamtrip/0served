import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import type {
  Report,
  Category,
  SiteSettings,
  MediaAsset,
  ContactMessage,
  AuditLog,
} from './types.ts';

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, '0served.db');
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    const dbPath = getDbPath();
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA synchronous = NORMAL;');
    initSchema(dbInstance);
  }
  return dbInstance;
}

/**
 * Initializes the relational schema, foreign key constraints, and indices.
 */
function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      user_agent TEXT,
      ip_address TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      slug TEXT UNIQUE NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      category_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
      author TEXT NOT NULL DEFAULT '0served Intelligence Unit',
      reading_time_minutes INTEGER NOT NULL DEFAULT 5,
      cover_image_url TEXT NOT NULL DEFAULT '',
      pdf_attachment_url TEXT NOT NULL DEFAULT '',
      seo_title TEXT NOT NULL DEFAULT '',
      seo_description TEXT NOT NULL DEFAULT '',
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reports_slug ON reports(slug);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_reports_published_at ON reports(published_at);
    CREATE INDEX IF NOT EXISTS idx_reports_category_id ON reports(category_id);

    CREATE TABLE IF NOT EXISTS slug_redirects (
      old_slug TEXT PRIMARY KEY,
      new_slug TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      public_url TEXT NOT NULL,
      report_id TEXT REFERENCES reports(id) ON DELETE SET NULL,
      alt_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      organization TEXT NOT NULL DEFAULT '',
      inquiry_type TEXT NOT NULL DEFAULT 'general',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread', 'read', 'archived')),
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 1,
      reset_at INTEGER NOT NULL
    );
  `);

  seedInitialData(db);
}

function seedInitialData(db: DatabaseSync) {
  const now = new Date().toISOString();

  // 1. Initial categories
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (catCount.count === 0) {
    const initialCategories = [
      {
        id: crypto.randomUUID(),
        name: 'Technology and software',
        slug: 'technology-and-software',
        description: 'Compute infrastructure, capital intensity, software economics, and architectural shifts across enterprise technology systems.',
        display_order: 1,
      },
      {
        id: crypto.randomUUID(),
        name: 'Industry and manufacturing',
        slug: 'industry-and-manufacturing',
        description: 'Physical industrial capacity, electrical interconnection queues, equipment supply chains, and manufacturing efficiency.',
        display_order: 2,
      },
      {
        id: crypto.randomUUID(),
        name: 'Markets and competitive dynamics',
        slug: 'markets-and-competitive-dynamics',
        description: 'Capital concentration, competitive moats, pricing discipline, and systemic vulnerabilities across modern markets.',
        display_order: 3,
      },
      {
        id: crypto.randomUUID(),
        name: 'Business strategy and emerging developments',
        slug: 'business-strategy-and-emerging-developments',
        description: 'Corporate incentives, balance sheet management, capital allocation tradeoffs, and institutional decision-making under uncertainty.',
        display_order: 4,
      },
    ];

    const insertCat = db.prepare(`
      INSERT INTO categories (id, name, slug, description, display_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `);

    for (const cat of initialCategories) {
      insertCat.run(cat.id, cat.name, cat.slug, cat.description, cat.display_order, now, now);
    }
  }

  // 2. Initial site settings
  const defaultSettings: Record<string, string> = {
    site_title: '0served',
    site_tagline: 'Independent research. Structured intelligence. Clearer decisions.',
    site_description:
      '0served is an independent research and intelligence publication. We investigate markets, companies, industries, competitive dynamics, and emerging developments to turn fragmented evidence into rigorous analysis and useful intelligence.',
    site_domain: 'oserved.com',
    contact_email: 'inquiries@oserved.com',
    contact_response_time: 'Inquiries are reviewed by the editorial desk within 2 business days.',
    twitter_url: 'https://x.com/0served',
    linkedin_url: 'https://linkedin.com/company/0served',
    github_url: 'https://github.com/divyamtrip/0served',
    featured_report_id: '',
    about_mission:
      '0served is an independent research and intelligence company. We examine markets, companies, industries, competitive dynamics, and technological transitions with an emphasis on primary evidence, balance sheet reality, and structural incentives.',
    about_methodology:
      'We turn fragmented information into structured evidence, rigorous analysis, and useful intelligence. Our research is conducted without promotional sponsor agendas, speculative narratives, or marketing compromises. We do not invent findings or adjust conclusions to fit market sentiment.',
    about_principles:
      '• Evidence over speculation.\n• Clarity over complexity.\n• Substance over promotional language.\n• Analytical depth over superficial summaries.\n• Independence, transparency, and intellectual rigor.',
  };

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO site_settings (key, value, updated_at)
    VALUES (?, ?, ?)
  `);

  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value, now);
  }

  // 3. Initial baseline publication (only if reports table is empty)
  const repCount = db.prepare('SELECT COUNT(*) as count FROM reports').get() as { count: number };
  if (repCount.count === 0) {
    const techCategory = db.prepare(`SELECT id, name FROM categories WHERE slug = 'technology-and-software' LIMIT 1`).get() as
      | { id: string; name: string }
      | undefined;

    const reportId = crypto.randomUUID();
    const publishedAt = '2026-09-18';

    const foundationalReportContent = `
## Executive Summary

As enterprise compute requirements expand, capital expenditure on accelerated hardware infrastructure has reached record levels. However, prevailing accounting conventions—principally straight-line depreciation schedules spanning five to six years—fail to reflect physical power degradation, thermal obsolescence, and rapid microarchitecture replacement cycles.

This report examines empirical data across 14 enterprise compute clusters, power interconnection filings, and corporate balance sheets to quantify the structural mismatch between reported earnings and true economic depreciation.

---

## Key Analytical Findings

1. **Depreciation Disconnect**: Average real economic lifespans for high-density compute accelerator nodes currently range from 32 to 40 months before maintenance and power penalties render ongoing operation uneconomic, compared to corporate accounting lifespans averaging 60 months.
2. **The Power Multiplier**: Energy availability has replaced silicon allocation as the primary constraint on capital deployment. Substation interconnection queues across major transmission operators now average 4.2 years.
3. **Residual Capital Risk**: The secondary resale value of decommissioned accelerator silicon has compressed by 68% over trailing 24-month periods, invalidating conventional salvage value assumptions.

---

## Compute Infrastructure Depreciation Schedules

The table below contrasts standard reported accounting depreciation against observed operational retirement schedules across modern high-density compute clusters.

| Asset Class | Accounting Schedule (Reported) | Economic Life (Observed) | Balance Sheet Lag |
| :--- | :--- | :--- | :--- |
| Accelerator Silicon (Tier-1) | 5.0 Years (60 Mo) | 3.1 Years (37 Mo) | +23 Months |
| High-Density Power Delivery | 10.0 Years (120 Mo) | 6.5 Years (78 Mo) | +42 Months |
| Liquid Cooling Distribution | 8.0 Years (96 Mo) | 4.8 Years (58 Mo) | +38 Months |
| Structural Facilities | 25.0 Years (300 Mo) | 22.0 Years (264 Mo) | +36 Months |

> [!NOTE]
> Source: 0served Field Intelligence, cluster operational logs, and public corporate regulatory filings (2024–2026).

---

## Power Interconnection Dynamics

Industrial power interconnect queues demonstrate that capacity expansion is no longer governed by hardware procurement lead times, but by high-voltage grid transmission upgrades.

\`\`\`
Transmission Interconnection Lead Times (Years)
2020: [==] 2.1 yrs
2022: [====] 3.2 yrs
2024: [======] 4.1 yrs
2026: [========] 4.8 yrs
\`\`\`

The capital intensity required to secure transmission access has increased fixed carrying costs for prospective operators, introducing asymmetric risk for levered infrastructure vehicles.

---

## Strategic Implications for Decision-Makers

Organizations deploying capital into technology infrastructure must adjust internal rate of return (IRR) models to reflect accelerated depreciation horizons and rising energy tariffs. Those relying on conventional corporate guidance risk substantial non-cash impairment charges within the next 24 to 36 months.

---

## Citations & Evidence Base

[^1]: Federal Energy Regulatory Commission (FERC) Interconnection Queue Reports, Q2 2026.
[^2]: 0served Compute Economics Database, Tracked Cohort A (14 Enterprise Clusters).
[^3]: Analysis of SEC Form 10-K asset capitalization and impairment schedules.
`;

    db.prepare(`
      INSERT INTO reports (
        id, title, subtitle, slug, summary, content, category_id, category_name,
        status, author, reading_time_minutes, cover_image_url, pdf_attachment_url,
        seo_title, seo_description, published_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        'published', '0served Intelligence Unit', 7, '', '',
        'Capital Allocation and Compute Economics | 0served',
        'An empirical analysis of hardware depreciation schedules, power constraints, and capital allocation across modern computing infrastructure.',
        ?, ?, ?
      )
    `).run(
      reportId,
      'Capital Allocation and Compute Economics: The Structural Shift in Infrastructure Depreciation',
      'An empirical analysis of hardware depreciation schedules, power constraints, and balance sheet distortions.',
      'capital-allocation-compute-economics',
      'An investigation into how accelerated hardware obsolescence, electrical interconnection delays, and data center capitalization conventions are reshaping balance sheets across enterprise technology infrastructure.',
      foundationalReportContent.trim(),
      techCategory ? techCategory.id : null,
      techCategory ? techCategory.name : 'Technology and software',
      publishedAt,
      now,
      now
    );

    // Update featured report setting
    db.prepare(`UPDATE site_settings SET value = ? WHERE key = 'featured_report_id'`).run(reportId);
  }
}

// ---------------------------------------------------------------------------
// Settings Queries
// ---------------------------------------------------------------------------

export function getSiteSettings(): SiteSettings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  return {
    site_title: map.site_title || '0served',
    site_tagline: map.site_tagline || 'Independent research. Structured intelligence. Clearer decisions.',
    site_description: map.site_description || '',
    site_domain: map.site_domain || 'oserved.com',
    contact_email: map.contact_email || 'inquiries@oserved.com',
    contact_response_time: map.contact_response_time || 'Within 2 business days.',
    twitter_url: map.twitter_url || 'https://x.com/0served',
    linkedin_url: map.linkedin_url || 'https://linkedin.com/company/0served',
    github_url: map.github_url || 'https://github.com/divyamtrip/0served',
    featured_report_id: map.featured_report_id || '',
    about_mission: map.about_mission || '',
    about_methodology: map.about_methodology || '',
    about_principles: map.about_principles || '',
  };
}

export function updateSiteSettings(settings: Partial<SiteSettings>): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  for (const [key, val] of Object.entries(settings)) {
    if (val !== undefined) {
      stmt.run(key, String(val), now);
    }
  }
}

// ---------------------------------------------------------------------------
// Category Queries
// ---------------------------------------------------------------------------

export function getCategories(includeInactive = false): Category[] {
  const db = getDb();
  const sql = includeInactive
    ? `
      SELECT c.*, 
        (SELECT COUNT(*) FROM reports r WHERE r.category_id = c.id AND r.status = 'published') as report_count
      FROM categories c
      ORDER BY c.display_order ASC, c.name ASC
    `
    : `
      SELECT c.*, 
        (SELECT COUNT(*) FROM reports r WHERE r.category_id = c.id AND r.status = 'published') as report_count
      FROM categories c
      WHERE c.is_active = 1
      ORDER BY c.display_order ASC, c.name ASC
    `;

  return db.prepare(sql).all() as unknown as Category[];
}

export function getCategoryBySlug(slug: string): Category | null {
  const db = getDb();
  const cat = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM reports r WHERE r.category_id = c.id AND r.status = 'published') as report_count
    FROM categories c
    WHERE c.slug = ?
    LIMIT 1
  `).get(slug) as unknown as Category | undefined;
  return cat || null;
}

export function getCategoryById(id: string): Category | null {
  const db = getDb();
  const cat = db.prepare('SELECT * FROM categories WHERE id = ? LIMIT 1').get(id) as unknown as Category | undefined;
  return cat || null;
}

export function createCategory(data: {
  name: string;
  slug: string;
  description?: string;
  display_order?: number;
  is_active?: number;
}): Category {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO categories (id, name, slug, description, display_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name.trim(),
    data.slug.trim(),
    (data.description || '').trim(),
    data.display_order ?? 0,
    data.is_active ?? 1,
    now,
    now
  );

  return getCategoryById(id)!;
}

export function updateCategory(
  id: string,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    display_order?: number;
    is_active?: number;
  }
): Category {
  const db = getDb();
  const now = new Date().toISOString();
  const current = getCategoryById(id);
  if (!current) throw new Error('Category not found');

  const name = data.name !== undefined ? data.name.trim() : current.name;
  const slug = data.slug !== undefined ? data.slug.trim() : current.slug;
  const description = data.description !== undefined ? data.description.trim() : current.description;
  const display_order = data.display_order !== undefined ? data.display_order : current.display_order;
  const is_active = data.is_active !== undefined ? data.is_active : current.is_active;

  db.prepare(`
    UPDATE categories
    SET name = ?, slug = ?, description = ?, display_order = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).run(name, slug, description, display_order, is_active, now, id);

  // If category name changed, update denormalized category_name on attached reports
  if (data.name !== undefined && data.name.trim() !== current.name) {
    db.prepare(`UPDATE reports SET category_name = ? WHERE category_id = ?`).run(name, id);
  }

  return getCategoryById(id)!;
}

export function deleteCategory(id: string): { success: boolean; error?: string } {
  const db = getDb();
  const reportCount = (
    db.prepare('SELECT COUNT(*) as count FROM reports WHERE category_id = ?').get(id) as { count: number }
  ).count;

  if (reportCount > 0) {
    return {
      success: false,
      error: `Cannot delete category: ${reportCount} report(s) are assigned to it. Reassign or delete those reports first.`,
    };
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Report Queries
// ---------------------------------------------------------------------------

export function getPublishedReports(options?: {
  categorySlug?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: 'newest' | 'oldest';
}): { reports: Report[]; total: number } {
  const db = getDb();
  const params: any[] = [];
  let where = "status = 'published'";

  if (options?.categorySlug) {
    const cat = getCategoryBySlug(options.categorySlug);
    if (cat) {
      where += ' AND category_id = ?';
      params.push(cat.id);
    } else {
      return { reports: [], total: 0 };
    }
  }

  if (options?.search && options.search.trim()) {
    where += ' AND (title LIKE ? OR summary LIKE ? OR content LIKE ?)';
    const term = `%${options.search.trim()}%`;
    params.push(term, term, term);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as count FROM reports WHERE ${where}`).get(...params) as { count: number };
  const total = countRow.count;

  const orderDir = options?.sort === 'oldest' ? 'ASC' : 'DESC';
  let query = `
    SELECT * FROM reports 
    WHERE ${where} 
    ORDER BY published_at ${orderDir}, created_at ${orderDir}
  `;

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const reports = db.prepare(query).all(...params) as unknown as Report[];
  return { reports, total };
}

export function getFeaturedReport(): Report | null {
  const db = getDb();
  const settings = getSiteSettings();

  if (settings.featured_report_id) {
    const report = db.prepare(`SELECT * FROM reports WHERE id = ? AND status = 'published'`).get(
      settings.featured_report_id
    ) as unknown as Report | undefined;
    if (report) return report;
  }

  // Fallback to most recent published report
  const latest = db.prepare(`SELECT * FROM reports WHERE status = 'published' ORDER BY published_at DESC, created_at DESC LIMIT 1`).get() as
    | unknown as Report
    | undefined;

  return latest || null;
}

export function getReportBySlug(slug: string): Report | null {
  const db = getDb();
  const report = db.prepare(`SELECT * FROM reports WHERE slug = ? LIMIT 1`).get(slug) as unknown as Report | undefined;
  return report || null;
}

export function getReportById(id: string): Report | null {
  const db = getDb();
  const report = db.prepare(`SELECT * FROM reports WHERE id = ? LIMIT 1`).get(id) as unknown as Report | undefined;
  return report || null;
}

export function getAllReportsAdmin(filter?: {
  status?: string;
  categoryId?: string;
  search?: string;
}): Report[] {
  const db = getDb();
  const params: any[] = [];
  const whereClauses: string[] = [];

  if (filter?.status && filter.status !== 'all') {
    whereClauses.push('status = ?');
    params.push(filter.status);
  }

  if (filter?.categoryId && filter.categoryId !== 'all') {
    whereClauses.push('category_id = ?');
    params.push(filter.categoryId);
  }

  if (filter?.search && filter.search.trim()) {
    whereClauses.push('(title LIKE ? OR summary LIKE ? OR slug LIKE ?)');
    const term = `%${filter.search.trim()}%`;
    params.push(term, term, term);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM reports 
    ${where}
    ORDER BY updated_at DESC, created_at DESC
  `;

  return db.prepare(sql).all(...params) as unknown as Report[];
}

export function createReport(data: {
  title: string;
  subtitle?: string;
  slug: string;
  summary: string;
  content: string;
  category_id?: string | null;
  status?: 'draft' | 'published' | 'archived';
  author?: string;
  reading_time_minutes?: number;
  cover_image_url?: string;
  pdf_attachment_url?: string;
  seo_title?: string;
  seo_description?: string;
  published_at?: string | null;
}): Report {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Validate or assign category name
  let categoryName = 'General Research';
  if (data.category_id) {
    const cat = getCategoryById(data.category_id);
    if (cat) categoryName = cat.name;
  }

  const status = data.status || 'draft';
  const publishedAt = status === 'published' ? data.published_at || new Date().toISOString().slice(0, 10) : data.published_at || null;

  // Calculate reading time if not explicitly provided
  const readingTime = data.reading_time_minutes || calculateReadingTime(data.content);

  db.prepare(`
    INSERT INTO reports (
      id, title, subtitle, slug, summary, content, category_id, category_name,
      status, author, reading_time_minutes, cover_image_url, pdf_attachment_url,
      seo_title, seo_description, published_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `).run(
    id,
    data.title.trim(),
    (data.subtitle || '').trim(),
    data.slug.trim(),
    data.summary.trim(),
    data.content,
    data.category_id || null,
    categoryName,
    status,
    (data.author || '0served Intelligence Unit').trim(),
    readingTime,
    (data.cover_image_url || '').trim(),
    (data.pdf_attachment_url || '').trim(),
    (data.seo_title || '').trim(),
    (data.seo_description || '').trim(),
    publishedAt,
    now,
    now
  );

  return getReportById(id)!;
}

export function updateReport(
  id: string,
  data: Partial<{
    title: string;
    subtitle: string;
    slug: string;
    summary: string;
    content: string;
    category_id: string | null;
    status: 'draft' | 'published' | 'archived';
    author: string;
    reading_time_minutes: number;
    cover_image_url: string;
    pdf_attachment_url: string;
    seo_title: string;
    seo_description: string;
    published_at: string | null;
  }>
): Report {
  const db = getDb();
  const current = getReportById(id);
  if (!current) throw new Error('Report not found');

  const now = new Date().toISOString();

  // Handle slug change and preserve redirect
  if (data.slug && data.slug.trim() !== current.slug) {
    const newSlug = data.slug.trim();
    db.prepare(`
      INSERT INTO slug_redirects (old_slug, new_slug, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(old_slug) DO UPDATE SET new_slug = excluded.new_slug, created_at = excluded.created_at
    `).run(current.slug, newSlug, now);
  }

  let categoryName = current.category_name;
  if (data.category_id !== undefined) {
    if (data.category_id) {
      const cat = getCategoryById(data.category_id);
      if (cat) categoryName = cat.name;
    } else {
      categoryName = 'General Research';
    }
  }

  const status = data.status !== undefined ? data.status : current.status;
  let publishedAt = current.published_at;
  if (data.published_at !== undefined) {
    publishedAt = data.published_at;
  } else if (status === 'published' && !publishedAt) {
    publishedAt = new Date().toISOString().slice(0, 10);
  }

  const content = data.content !== undefined ? data.content : current.content;
  const readingTime =
    data.reading_time_minutes !== undefined ? data.reading_time_minutes : calculateReadingTime(content);

  db.prepare(`
    UPDATE reports SET
      title = ?,
      subtitle = ?,
      slug = ?,
      summary = ?,
      content = ?,
      category_id = ?,
      category_name = ?,
      status = ?,
      author = ?,
      reading_time_minutes = ?,
      cover_image_url = ?,
      pdf_attachment_url = ?,
      seo_title = ?,
      seo_description = ?,
      published_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    data.title !== undefined ? data.title.trim() : current.title,
    data.subtitle !== undefined ? data.subtitle.trim() : current.subtitle,
    data.slug !== undefined ? data.slug.trim() : current.slug,
    data.summary !== undefined ? data.summary.trim() : current.summary,
    content,
    data.category_id !== undefined ? data.category_id : current.category_id,
    categoryName,
    status,
    data.author !== undefined ? data.author.trim() : current.author,
    readingTime,
    data.cover_image_url !== undefined ? data.cover_image_url.trim() : current.cover_image_url,
    data.pdf_attachment_url !== undefined ? data.pdf_attachment_url.trim() : current.pdf_attachment_url,
    data.seo_title !== undefined ? data.seo_title.trim() : current.seo_title,
    data.seo_description !== undefined ? data.seo_description.trim() : current.seo_description,
    publishedAt,
    now,
    id
  );

  return getReportById(id)!;
}

export function duplicateReport(id: string): Report {
  const current = getReportById(id);
  if (!current) throw new Error('Report not found');

  const baseSlug = `${current.slug}-copy`;
  let candidateSlug = baseSlug;
  let counter = 1;
  while (getReportBySlug(candidateSlug)) {
    counter++;
    candidateSlug = `${baseSlug}-${counter}`;
  }

  return createReport({
    title: `${current.title} (Copy)`,
    subtitle: current.subtitle,
    slug: candidateSlug,
    summary: current.summary,
    content: current.content,
    category_id: current.category_id,
    status: 'draft',
    author: current.author,
    reading_time_minutes: current.reading_time_minutes,
    cover_image_url: current.cover_image_url,
    pdf_attachment_url: current.pdf_attachment_url,
    seo_title: current.seo_title ? `${current.seo_title} (Copy)` : '',
    seo_description: current.seo_description,
    published_at: null,
  });
}

export function deleteReport(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM reports WHERE id = ?').run(id);
}

export function resolveSlugRedirect(slug: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT new_slug FROM slug_redirects WHERE old_slug = ? LIMIT 1').get(slug) as
    | { new_slug: string }
    | undefined;
  return row ? row.new_slug : null;
}

// ---------------------------------------------------------------------------
// Media Management
// ---------------------------------------------------------------------------

export function getMediaAssets(): MediaAsset[] {
  const db = getDb();
  return db.prepare('SELECT * FROM media ORDER BY created_at DESC').all() as unknown as MediaAsset[];
}

export function getMediaAssetById(id: string): MediaAsset | null {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM media WHERE id = ? LIMIT 1').get(id) as unknown as MediaAsset | undefined;
  return asset || null;
}

export function saveMediaAsset(data: {
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  public_url: string;
  report_id?: string | null;
  alt_text?: string;
}): MediaAsset {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO media (id, filename, original_name, mime_type, file_size, storage_path, public_url, report_id, alt_text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.filename,
    data.original_name,
    data.mime_type,
    data.file_size,
    data.storage_path,
    data.public_url,
    data.report_id || null,
    data.alt_text || '',
    now
  );

  return getMediaAssetById(id)!;
}

export function deleteMediaAsset(id: string): { success: boolean; storage_path?: string } {
  const db = getDb();
  const asset = getMediaAssetById(id);
  if (!asset) return { success: false };

  db.prepare('DELETE FROM media WHERE id = ?').run(id);
  return { success: true, storage_path: asset.storage_path };
}

// ---------------------------------------------------------------------------
// Inquiries (Contact messages)
// ---------------------------------------------------------------------------

export function saveContactMessage(data: {
  name: string;
  email: string;
  organization?: string;
  inquiry_type?: string;
  message: string;
  ip_address?: string | null;
}): ContactMessage {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO contact_messages (id, name, email, organization, inquiry_type, message, status, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'unread', ?, ?)
  `).run(
    id,
    data.name.trim(),
    data.email.trim(),
    (data.organization || '').trim(),
    (data.inquiry_type || 'general').trim(),
    data.message.trim(),
    data.ip_address || null,
    now
  );

  return db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(id) as unknown as ContactMessage;
}

export function getContactMessages(): ContactMessage[] {
  const db = getDb();
  return db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all() as unknown as ContactMessage[];
}

export function markContactMessageStatus(id: string, status: 'unread' | 'read' | 'archived'): void {
  const db = getDb();
  db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(status, id);
}

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export function logAudit(data: {
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any> | string;
}): void {
  try {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const detailsStr = typeof data.details === 'object' ? JSON.stringify(data.details) : data.details || null;

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.user_id || null, data.action, data.entity_type, data.entity_id || null, detailsStr, now);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function calculateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // Standard research reading speed: 200 words per minute
  return Math.max(1, Math.ceil(words / 200));
}
