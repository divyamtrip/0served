import type { APIRoute } from 'astro';
import { getDb, logAudit } from '../../../../lib/db.ts';
import {
  verifyPassword,
  createSession,
  checkRateLimit,
  clearRateLimit,
  getSessionCookieHeader,
} from '../../../../lib/auth.ts';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const ip = clientAddress || request.headers.get('x-forwarded-for') || '127.0.0.1';

    // 1. Rate Limiting: 5 attempts per 15 minutes per IP
    const rateCheck = checkRateLimit(`login:ip:${ip}`, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: `Too many login attempts. Access temporarily restricted. Try again in ${rateCheck.resetInSec} seconds.`,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Rate limit per email address as well
    const emailRateCheck = checkRateLimit(`login:email:${email}`, 5, 15 * 60 * 1000);
    if (!emailRateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: `Too many failed attempts for this account. Try again in ${emailRateCheck.resetInSec} seconds.`,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').get(email) as any;

    if (!user || user.status !== 'active') {
      logAudit({
        action: 'login_failed',
        entity_type: 'user',
        details: { email, reason: 'user_not_found_or_inactive', ip },
      });
      return new Response(JSON.stringify({ error: 'Invalid authentication credentials.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify password in constant time
    const passwordValid = verifyPassword(password, user.password_hash, user.salt);
    if (!passwordValid) {
      logAudit({
        action: 'login_failed',
        entity_type: 'user',
        entity_id: user.id,
        details: { email, reason: 'invalid_password', ip },
      });
      return new Response(JSON.stringify({ error: 'Invalid authentication credentials.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Successful login: Clear rate limits
    clearRateLimit(`login:ip:${ip}`);
    clearRateLimit(`login:email:${email}`);

    // Update last_login_at
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);

    // Create session
    const userAgent = request.headers.get('user-agent');
    const { rawToken } = createSession(user.id, ip, userAgent, 7);

    logAudit({
      user_id: user.id,
      action: 'login_success',
      entity_type: 'user',
      entity_id: user.id,
      details: { email, ip },
    });

    const cookieHeader = getSessionCookieHeader(rawToken, 7);

    return new Response(JSON.stringify({ success: true, redirect: '/admin' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return new Response(JSON.stringify({ error: 'An internal authentication error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
