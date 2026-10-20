import type { APIRoute } from 'astro';
import { createCategory, getCategoryBySlug, logAudit } from '../../../../lib/db.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Category name is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let slug = (body.slug || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    if (!slug) {
      slug = body.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
    }

    const existing = getCategoryBySlug(slug);
    if (existing) {
      return new Response(
        JSON.stringify({ error: `A category with slug "${slug}" already exists.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const category = createCategory({
      name: body.name,
      slug,
      description: body.description || '',
      display_order: body.display_order ? Number(body.display_order) : 0,
      is_active: body.is_active !== undefined ? Number(body.is_active) : 1,
    });

    logAudit({
      user_id: user?.id,
      action: 'category_created',
      entity_type: 'category',
      entity_id: category.id,
      details: { name: category.name, slug: category.slug },
    });

    return new Response(JSON.stringify({ success: true, category }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to create category' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
