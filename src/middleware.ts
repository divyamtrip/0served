import { defineMiddleware } from 'astro:middleware';
import { validateSession, SESSION_COOKIE_NAME } from './lib/auth.ts';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, locals } = context;
  const pathname = url.pathname;

  // Check if route is an admin route or protected API
  const isAdminPage = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const isAdminApi = pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/auth/login');

  if (isAdminPage || isAdminApi) {
    const sessionCookie = cookies.get(SESSION_COOKIE_NAME)?.value;
    const auth = validateSession(sessionCookie);

    if (!auth || auth.user.role !== 'owner') {
      if (isAdminApi) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Owner session required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect('/admin/login');
    }

    // Attach validated auth to locals
    locals.user = auth.user;
    locals.session = auth.session;
  }

  return next();
});
