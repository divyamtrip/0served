import crypto from 'node:crypto';
import type { User, Session } from './types.ts';
import { getDb } from './db.ts';

const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
};
const KEY_LEN = 64;

/**
 * Hashes a plaintext password using scrypt with a unique 16-byte cryptographically secure salt.
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_OPTIONS);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Constant-time verification of a plaintext password against a stored hash and salt.
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_OPTIONS);
    const keyBuf = Buffer.from(derivedKey.toString('hex'), 'hex');
    const hashBuf = Buffer.from(storedHash, 'hex');
    if (keyBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, hashBuf);
  } catch {
    return false;
  }
}

/**
 * Creates a SHA-256 hash of a session token for storage.
 * The raw token is stored in the user's secure HTTP-only cookie,
 * while only the token_hash is persisted in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a new authenticated session for a user.
 */
export function createSession(
  userId: string,
  ipAddress?: string | null,
  userAgent?: string | null,
  durationDays = 7
): { session: Session; rawToken: string } {
  const db = getDb();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, user_agent, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, tokenHash, expiresAt, createdAt, userAgent || null, ipAddress || null);

  const session: Session = {
    id,
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_at: createdAt,
    user_agent: userAgent || null,
    ip_address: ipAddress || null,
  };

  return { session, rawToken };
}

/**
 * Validates a session token from an incoming cookie.
 * Returns the authenticated user and session, or null if invalid/expired.
 */
export function validateSession(rawToken?: string | null): { user: User; session: Session } | null {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) {
    return null;
  }

  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();

  const row = db.prepare(`
    SELECT 
      s.id as session_id, s.user_id, s.token_hash, s.expires_at, s.created_at as session_created_at,
      s.user_agent, s.ip_address,
      u.id as user_id, u.email, u.password_hash, u.salt, u.role, u.status, u.created_at as user_created_at,
      u.last_login_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
    LIMIT 1
  `).get(tokenHash, now) as Record<string, any> | undefined;

  if (!row) {
    return null;
  }

  const user: User = {
    id: row.user_id,
    email: row.email,
    password_hash: row.password_hash,
    salt: row.salt,
    role: row.role,
    status: row.status,
    created_at: row.user_created_at,
    last_login_at: row.last_login_at,
  };

  const session: Session = {
    id: row.session_id,
    user_id: row.user_id,
    token_hash: row.token_hash,
    expires_at: row.expires_at,
    created_at: row.session_created_at,
    user_agent: row.user_agent,
    ip_address: row.ip_address,
  };

  return { user, session };
}

/**
 * Destroys a session given its raw token.
 */
export function destroySession(rawToken?: string | null): void {
  if (!rawToken) return;
  const db = getDb();
  const tokenHash = hashToken(rawToken);
  db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
}

/**
 * Destroys all sessions for a user (e.g., on password reset or account revocation).
 */
export function destroyAllUserSessions(userId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}

/**
 * Sliding-window rate limiter using SQLite.
 * Protects login and sensitive forms against brute-force attacks.
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
): { allowed: boolean; remaining: number; resetInSec: number } {
  const db = getDb();
  const now = Date.now();

  // Clean expired
  db.prepare(`DELETE FROM rate_limits WHERE reset_at < ?`).run(now);

  const existing = db.prepare(`SELECT attempts, reset_at FROM rate_limits WHERE key = ?`).get(key) as
    | { attempts: number; reset_at: number }
    | undefined;

  if (!existing) {
    const resetAt = now + windowMs;
    db.prepare(`INSERT INTO rate_limits (key, attempts, reset_at) VALUES (?, 1, ?)`).run(key, resetAt);
    return { allowed: true, remaining: maxAttempts - 1, resetInSec: Math.ceil(windowMs / 1000) };
  }

  if (existing.attempts >= maxAttempts) {
    const resetInSec = Math.max(1, Math.ceil((existing.reset_at - now) / 1000));
    return { allowed: false, remaining: 0, resetInSec };
  }

  const updatedAttempts = existing.attempts + 1;
  db.prepare(`UPDATE rate_limits SET attempts = ? WHERE key = ?`).run(updatedAttempts, key);
  const resetInSec = Math.max(1, Math.ceil((existing.reset_at - now) / 1000));

  return {
    allowed: true,
    remaining: maxAttempts - updatedAttempts,
    resetInSec,
  };
}

/**
 * Resets a rate limit key upon successful authentication.
 */
export function clearRateLimit(key: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM rate_limits WHERE key = ?`).run(key);
}

/**
 * Cookie options helper for secure session cookies.
 */
export const SESSION_COOKIE_NAME = 'oserved_session';
export const CSRF_COOKIE_NAME = 'oserved_csrf';

export function getSessionCookieHeader(rawToken: string, maxAgeDays = 7): string {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = maxAgeDays * 24 * 60 * 60;
  return `${SESSION_COOKIE_NAME}=${rawToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProd ? '; Secure' : ''}`;
}

export function getClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
