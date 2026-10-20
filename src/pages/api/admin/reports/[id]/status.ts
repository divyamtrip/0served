import type { APIRoute } from 'astro';
import { updateReport, getReportById, logAudit } from '../../../../../lib/db.ts';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  if (!id) return new Response('Missing ID', { status: 400 });

  const existing = getReportById(id);
  if (!existing) return new Response('Not found', { status: 404 });

  const body = await request.json();
  const status = body.status;

  if (!['draft', 'published', 'archived'].includes(status)) {
    return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400 });
  }

  const user = locals.user;
  const publishedAt =
    status === 'published' && !existing.published_at
      ? new Date().toISOString().slice(0, 10)
      : existing.published_at;

  const updated = updateReport(id, {
    status,
    published_at: publishedAt,
  });

  logAudit({
    user_id: user?.id,
    action: `report_${status}`,
    entity_type: 'report',
    entity_id: id,
    details: { title: updated.title, new_status: status },
  });

  return new Response(JSON.stringify({ success: true, report: updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
