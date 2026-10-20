import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

// Setup an isolated in-memory or test database
const testDbDir = path.join(process.cwd(), 'data', 'test');
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true });
}
const testDbPath = path.join(testDbDir, `test-${Date.now()}.db`);
process.env.DATABASE_PATH = testDbPath;

// Dynamic import of application libraries with test DB
const {
  getDb,
  getSiteSettings,
  updateSiteSettings,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createReport,
  updateReport,
  getReportById,
  getReportBySlug,
  getPublishedReports,
  duplicateReport,
  deleteReport,
  resolveSlugRedirect,
  saveMediaAsset,
  getMediaAssets,
  deleteMediaAsset,
  saveContactMessage,
  getContactMessages,
  markContactMessageStatus,
} = await import('../src/lib/db.ts');

const {
  hashPassword,
  verifyPassword,
  createSession,
  validateSession,
  destroySession,
  checkRateLimit,
  clearRateLimit,
} = await import('../src/lib/auth.ts');

test('1. Database Initialization & Seeding', () => {
  const db = getDb();
  assert.ok(db, 'Database instance must be initialized');

  const settings = getSiteSettings();
  assert.strictEqual(settings.site_title, '0served', 'Default site title must be 0served');
  assert.strictEqual(settings.site_domain, 'oserved.com', 'Default site domain must be oserved.com');

  const categories = getCategories();
  assert.ok(categories.length >= 4, 'Should initialize with at least 4 default categories');

  const { reports } = getPublishedReports();
  assert.ok(reports.length >= 1, 'Should have initial foundational publication report');
});

test('2. Owner Authentication & Cryptographic Hashing', () => {
  const password = 'StrongIntelligencePassword2026!';
  const { hash, salt } = hashPassword(password);

  assert.ok(hash && hash.length === 128, 'Derived scrypt key must be 64 bytes (128 hex chars)');
  assert.ok(salt && salt.length === 32, 'Salt must be 16 bytes (32 hex chars)');

  // Verify correct password
  const valid = verifyPassword(password, hash, salt);
  assert.strictEqual(valid, true, 'Correct password must verify successfully');

  // Verify wrong password fails
  const wrong = verifyPassword('WrongPassword123!', hash, salt);
  assert.strictEqual(wrong, false, 'Incorrect password must be rejected');

  // Verify timing-safe rejection for mismatched lengths
  const invalidHash = verifyPassword(password, 'short', salt);
  assert.strictEqual(invalidHash, false, 'Malformed hash must be rejected');
});

test('3. Session Creation, Validation, and Destruction', () => {
  const db = getDb();
  const userId = crypto.randomUUID();
  const email = `test-owner-${Date.now()}@oserved.com`;
  const { hash, salt } = hashPassword('SecretTestPass123!');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, role, status, created_at)
    VALUES (?, ?, ?, ?, 'owner', 'active', ?)
  `).run(userId, email, hash, salt, now);

  // Create session
  const { session, rawToken } = createSession(userId, '127.0.0.1', 'NodeTestRunner');
  assert.ok(session.id, 'Session must have an ID');
  assert.ok(rawToken.length >= 64, 'Raw token must be 32 bytes (64 hex characters)');

  // Validate session
  const auth = validateSession(rawToken);
  assert.ok(auth, 'Valid token must resolve user and session');
  assert.strictEqual(auth.user.email, email, 'Session user email must match');
  assert.strictEqual(auth.user.role, 'owner', 'Session user role must be owner');

  // Validate invalid token
  const fakeAuth = validateSession('invalid-token-string-that-does-not-exist-in-db-at-all');
  assert.strictEqual(fakeAuth, null, 'Invalid token must resolve to null');

  // Destroy session
  destroySession(rawToken);
  const postDestroyAuth = validateSession(rawToken);
  assert.strictEqual(postDestroyAuth, null, 'Destroyed session must be rejected');
});

test('4. Rate Limiting Protection', () => {
  const testKey = `test:ip:10.0.0.${Date.now()}`;
  clearRateLimit(testKey);

  // Perform 4 allowed attempts (limit: 4)
  for (let i = 1; i <= 4; i++) {
    const res = checkRateLimit(testKey, 4, 60000);
    assert.strictEqual(res.allowed, true, `Attempt ${i} should be allowed`);
  }

  // 5th attempt must be blocked
  const blockedRes = checkRateLimit(testKey, 4, 60000);
  assert.strictEqual(blockedRes.allowed, false, 'Attempt exceeding maximum must be blocked');
  assert.strictEqual(blockedRes.remaining, 0, 'Remaining attempts must be 0');
  assert.ok(blockedRes.resetInSec > 0, 'Reset seconds must be positive');

  // Clear rate limit
  clearRateLimit(testKey);
  const resetRes = checkRateLimit(testKey, 4, 60000);
  assert.strictEqual(resetRes.allowed, true, 'Rate limit should be reset');
});

test('5. Report Publishing Lifecycle & Access Boundaries', () => {
  const initialCategory = getCategories()[0];
  const uniqueSlug = `investigation-test-${Date.now()}`;

  // 1. Create a DRAFT report
  const draft = createReport({
    title: 'Test Private Draft Investigation',
    subtitle: 'Confidential analytical memorandum',
    slug: uniqueSlug,
    summary: 'Executive brief for internal research.',
    content: '## Draft Content\n\nPreliminary findings regarding industrial capacity.',
    category_id: initialCategory.id,
    status: 'draft',
    author: '0served Field Team',
  });

  assert.strictEqual(draft.status, 'draft', 'Report must start as draft');

  // 2. Verify draft does NOT appear in public listing
  const publicList = getPublishedReports();
  const leakedInPublic = publicList.reports.some((r) => r.id === draft.id);
  assert.strictEqual(leakedInPublic, false, 'Draft must NOT appear in public published reports');

  // 3. Publish report
  const published = updateReport(draft.id, {
    status: 'published',
  });
  assert.strictEqual(published.status, 'published', 'Report status must update to published');
  assert.ok(published.published_at, 'Publication date must be populated upon publishing');

  // 4. Verify it now appears in public listings
  const publicListAfter = getPublishedReports();
  const visibleInPublic = publicListAfter.reports.some((r) => r.id === draft.id);
  assert.strictEqual(visibleInPublic, true, 'Published report must appear in public listing');

  // 5. Change Slug and test Redirect Preservation
  const updatedSlug = `${uniqueSlug}-revised`;
  updateReport(draft.id, {
    slug: updatedSlug,
  });

  const redirected = resolveSlugRedirect(uniqueSlug);
  assert.strictEqual(redirected, updatedSlug, 'Old slug must redirect to updated slug');

  // 6. Unpublish report (return to draft)
  const unpublished = updateReport(draft.id, {
    status: 'draft',
  });
  assert.strictEqual(unpublished.status, 'draft', 'Report must return to draft');

  const publicListUnpublished = getPublishedReports();
  const visibleAfterUnpublish = publicListUnpublished.reports.some((r) => r.id === draft.id);
  assert.strictEqual(visibleAfterUnpublish, false, 'Unpublished report must disappear from public listings');

  // 7. Duplicate report
  const duplicated = duplicateReport(draft.id);
  assert.strictEqual(duplicated.status, 'draft', 'Duplicated report must be created as draft');
  assert.ok(duplicated.slug.includes('-copy'), 'Duplicated slug must contain copy suffix');
  assert.notStrictEqual(duplicated.id, draft.id, 'Duplicated report must have new unique ID');

  // 8. Delete report
  deleteReport(duplicated.id);
  assert.strictEqual(getReportById(duplicated.id), null, 'Deleted report must not exist');
  deleteReport(draft.id);
});

test('6. Category Management & Referential Integrity', () => {
  const newCatSlug = `energy-grids-${Date.now()}`;
  const cat = createCategory({
    name: 'Energy & Grid Infrastructure',
    slug: newCatSlug,
    description: 'Transmission corridors and substations.',
    display_order: 10,
    is_active: 1,
  });

  assert.strictEqual(cat.name, 'Energy & Grid Infrastructure');

  // Assign a report to this category
  const rep = createReport({
    title: 'High Voltage Transmission Capacity',
    slug: `hvdc-${Date.now()}`,
    summary: 'Grid constraints analysis.',
    content: 'Content here.',
    category_id: cat.id,
    status: 'draft',
  });

  // Attempt to delete category with report assigned -> MUST FAIL
  const deleteAttempt = deleteCategory(cat.id);
  assert.strictEqual(deleteAttempt.success, false, 'Deleting category with assigned reports must fail safely');
  assert.ok(deleteAttempt.error?.includes('assigned'), 'Error must inform user of assigned reports');

  // Remove report, then delete category -> MUST SUCCEED
  deleteReport(rep.id);
  const deleteSuccess = deleteCategory(cat.id);
  assert.strictEqual(deleteSuccess.success, true, 'Deleting unassigned category must succeed');
});

test('7. Persistent Site Settings', () => {
  const initialSettings = getSiteSettings();
  assert.ok(initialSettings.site_title, 'Should read initial title');

  updateSiteSettings({
    site_tagline: 'Precision analysis for institutional decisions.',
    contact_email: 'desk@oserved.com',
  });

  const updatedSettings = getSiteSettings();
  assert.strictEqual(
    updatedSettings.site_tagline,
    'Precision analysis for institutional decisions.',
    'Tagline must be persistently updated'
  );
  assert.strictEqual(
    updatedSettings.contact_email,
    'desk@oserved.com',
    'Contact email must be persistently updated'
  );
});

test('8. Media Asset Tracking', () => {
  const asset = saveMediaAsset({
    filename: 'test-chart.png',
    original_name: 'Compute_Depreciation_Q3.png',
    mime_type: 'image/png',
    file_size: 142050,
    storage_path: '/tmp/test-chart.png',
    public_url: '/uploads/test-chart.png',
  });

  assert.ok(asset.id, 'Asset must receive unique UUID');
  const allMedia = getMediaAssets();
  assert.ok(allMedia.some((m) => m.id === asset.id), 'Asset must be retrievable from media list');

  const del = deleteMediaAsset(asset.id);
  assert.strictEqual(del.success, true, 'Media asset record must delete cleanly');
});

test('9. Contact Messages & Status Flow', () => {
  const inquiry = saveContactMessage({
    name: 'Marcus Vance',
    email: 'm.vance@fund.com',
    organization: 'Vance Capital Research',
    inquiry_type: 'research_request',
    message: 'We are reviewing industrial power tariffs and would like to cite your recent report.',
    ip_address: '192.168.1.1',
  });

  assert.strictEqual(inquiry.status, 'unread', 'New inquiry must default to unread');

  const messages = getContactMessages();
  assert.ok(messages.some((m) => m.id === inquiry.id), 'Inquiry must be saved to database');

  markContactMessageStatus(inquiry.id, 'read');
  const readMessages = getContactMessages();
  const updatedInq = readMessages.find((m) => m.id === inquiry.id);
  assert.strictEqual(updatedInq?.status, 'read', 'Inquiry must transition to read');
});

// Cleanup test database files after run
test.after(() => {
  try {
    for (const suffix of ['', '-wal', '-shm']) {
      const file = testDbPath + suffix;
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  } catch (err) {
    // Ignore cleanup error
  }
});
