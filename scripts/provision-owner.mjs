#!/usr/bin/env node

/**
 * 0served Owner Account Provisioning Script
 * 
 * Usage:
 *   node scripts/provision-owner.mjs --email=owner@oserved.com --password=YourStrongPassword123!
 *   or via environment variables:
 *   INITIAL_OWNER_EMAIL=owner@oserved.com INITIAL_OWNER_PASSWORD=... node scripts/provision-owner.mjs
 */

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, '0served.db');
const db = new DatabaseSync(dbPath);

// Parse CLI flags or env vars
const args = process.argv.slice(2);
const cliArgs = {};
for (const arg of args) {
  if (arg.startsWith('--')) {
    const [k, v] = arg.slice(2).split('=');
    cliArgs[k] = v;
  }
}

const email = (cliArgs.email || process.env.INITIAL_OWNER_EMAIL || '').trim().toLowerCase();
const password = cliArgs.password || process.env.INITIAL_OWNER_PASSWORD || '';

if (!email || !password) {
  console.error('\n[0served] Error: Email and password are required.');
  console.error('Usage:');
  console.error('  node scripts/provision-owner.mjs --email=owner@oserved.com --password="YourSecurePassword123!"');
  console.error('Or set environment variables INITIAL_OWNER_EMAIL and INITIAL_OWNER_PASSWORD.\n');
  process.exit(1);
}

if (!email.includes('@') || email.length < 5) {
  console.error('\n[0served] Error: Invalid email address format.\n');
  process.exit(1);
}

if (password.length < 10) {
  console.error('\n[0served] Error: Password must be at least 10 characters long for security.\n');
  process.exit(1);
}

// Scrypt hashing
const salt = crypto.randomBytes(16).toString('hex');
const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
const passwordHash = derivedKey.toString('hex');
const now = new Date().toISOString();

// Ensure users table exists
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
`);

const existingUser = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email);

if (existingUser) {
  db.prepare(`
    UPDATE users 
    SET password_hash = ?, salt = ?, status = 'active', role = 'owner'
    WHERE email = ?
  `).run(passwordHash, salt, email);

  console.log(`\n[0served] Success: Owner credentials updated for "${email}".`);
  console.log('You can now log in at /admin/login\n');
} else {
  const userId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, role, status, created_at)
    VALUES (?, ?, ?, ?, 'owner', 'active', ?)
  `).run(userId, email, passwordHash, salt, now);

  console.log(`\n[0served] Success: Owner account provisioned for "${email}".`);
  console.log('You can now log in at /admin/login\n');
}
