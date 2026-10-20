import type { APIRoute } from 'astro';
import { createReport, getReportBySlug, logAudit } from '../../../../lib/db.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    const body = await request.json();

    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Report title is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.summary || typeof body.summary !== 'string' || body.summary.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Executive summary is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate or clean slug
    let slug = (body.slug || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    if (!slug) {
      slug = body.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
    }

    // Ensure slug uniqueness
    const existing = getReportBySlug(slug);
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const report = createReport({
      title: body.title,
      subtitle: body.subtitle || '',
      slug,
      summary: body.summary,
      content: body.content || '',
      category_id: body.category_id || null,
      status: body.status || 'draft',
      author: body.author || '0served Intelligence Unit',
      reading_time_minutes: body.reading_time_minutes ? Number(body.reading_time_minutes) : undefined,
      cover_image_url: body.cover_image_url || '',
      pdf_attachment_url: body.pdf_attachment_url || '',
      seo_title: body.seo_title || '',
      seo_description: body.seo_description || '',
      published_at: body.status === 'published' ? (body.published_at || new Date().toISOString().slice(0, 10)) : null,
    });

    logAudit({
      user_id: user?.id,
      action: 'report_created',
      entity_type: 'report',
      entity_id: report.id,
      details: { title: report.title, slug: report.slug, status: report.status },
    });

    return new Response(JSON.stringify({ success: true, report }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Create report error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to create report' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
