import type { APIRoute } from 'astro';
import { duplicateReport, logAudit } from '../../../../../lib/db.ts';

export const POST: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) return new Response('Missing ID', { status: 400 });

  try {
    const user = locals.user;
    const duplicated = duplicateReport(id);

    logAudit({
      user_id: user?.id,
      action: 'report_duplicated',
      entity_type: 'report',
      entity_id: duplicated.id,
      details: { original_id: id, new_title: duplicated.title, new_slug: duplicated.slug },
    });

    return new Response(JSON.stringify({ success: true, report: duplicated }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to duplicate report' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
