import type { APIRoute } from 'astro';
import { destroySession, getClearSessionCookieHeader, SESSION_COOKIE_NAME } from '../../../../lib/auth.ts';
import { logAudit } from '../../../../lib/db.ts';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const rawToken = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    destroySession(rawToken);
    logAudit({
      action: 'logout',
      entity_type: 'session',
    });
  }

  return new Response(JSON.stringify({ success: true, redirect: '/admin/login' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': getClearSessionCookieHeader(),
    },
  });
};

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const rawToken = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    destroySession(rawToken);
  }

  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  return redirect('/admin/login');
};
