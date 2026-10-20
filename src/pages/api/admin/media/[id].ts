import type { APIRoute } from 'astro';
import fs from 'node:fs';
import { deleteMediaAsset, logAudit } from '../../../../lib/db.ts';

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) return new Response('Missing ID', { status: 400 });

  const result = deleteMediaAsset(id);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Asset not found' }), { status: 404 });
  }

  // Remove from filesystem if present
  if (result.storage_path && fs.existsSync(result.storage_path)) {
    try {
      fs.unlinkSync(result.storage_path);
    } catch (err) {
      console.error('Failed to unlink asset from disk:', err);
    }
  }

  const user = locals.user;
  logAudit({
    user_id: user?.id,
    action: 'media_deleted',
    entity_type: 'media',
    entity_id: id,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
