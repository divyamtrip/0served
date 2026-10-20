import type { APIRoute } from 'astro';
import { updateSiteSettings, logAudit } from '../../../lib/db.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    const body = await request.json();

    updateSiteSettings(body);

    logAudit({
      user_id: user?.id,
      action: 'settings_updated',
      entity_type: 'site_settings',
      details: Object.keys(body),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Settings update error:', err);
    return new Response(JSON.stringify({ error: 'Failed to update site settings.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
