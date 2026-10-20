import type { APIRoute } from 'astro';
import { markContactMessageStatus, logAudit } from '../../../../../lib/db.ts';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  if (!id) return new Response('Missing ID', { status: 400 });

  const body = await request.json();
  const status = body.status;

  if (!['unread', 'read', 'archived'].includes(status)) {
    return new Response(JSON.stringify({ error: 'Invalid inquiry status' }), { status: 400 });
  }

  const user = locals.user;
  markContactMessageStatus(id, status);

  logAudit({
    user_id: user?.id,
    action: 'inquiry_status_updated',
    entity_type: 'contact_message',
    entity_id: id,
    details: { new_status: status },
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
