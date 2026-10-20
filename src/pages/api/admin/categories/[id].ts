import type { APIRoute } from 'astro';
import {
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryBySlug,
  logAudit,
} from '../../../../lib/db.ts';

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  if (!id) return new Response('Missing ID', { status: 400 });

  const existing = getCategoryById(id);
  if (!existing) return new Response('Not found', { status: 404 });

  const body = await request.json();

  if (body.slug && body.slug.trim() !== existing.slug) {
    const cleanSlug = body.slug
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    const slugTaken = getCategoryBySlug(cleanSlug);
    if (slugTaken && slugTaken.id !== id) {
      return new Response(
        JSON.stringify({ error: `Category slug "${cleanSlug}" is already in use.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    body.slug = cleanSlug;
  }

  const user = locals.user;
  const updated = updateCategory(id, body);

  logAudit({
    user_id: user?.id,
    action: 'category_updated',
    entity_type: 'category',
    entity_id: id,
    details: { name: updated.name, slug: updated.slug },
  });

  return new Response(JSON.stringify({ success: true, category: updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) return new Response('Missing ID', { status: 400 });

  const existing = getCategoryById(id);
  if (!existing) return new Response('Not found', { status: 404 });

  const result = deleteCategory(id);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = locals.user;
  logAudit({
    user_id: user?.id,
    action: 'category_deleted',
    entity_type: 'category',
    entity_id: id,
    details: { name: existing.name, slug: existing.slug },
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
