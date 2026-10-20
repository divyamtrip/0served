import type { APIRoute } from 'astro';
import {
  getReportById,
  updateReport,
  deleteReport,
  getReportBySlug,
  logAudit,
} from '../../../../lib/db.ts';

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return new Response('Missing ID', { status: 400 });

  const report = getReportById(id);
  if (!report) return new Response('Not found', { status: 404 });

  return new Response(JSON.stringify({ report }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  if (!id) return new Response('Missing ID', { status: 400 });

  const existing = getReportById(id);
  if (!existing) return new Response('Not found', { status: 404 });

  const user = locals.user;
  const body = await request.json();

  // If slug is changed, check for collision
  if (body.slug && body.slug.trim() !== existing.slug) {
    const cleanSlug = body.slug
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    const slugTaken = getReportBySlug(cleanSlug);
    if (slugTaken && slugTaken.id !== id) {
      return new Response(
        JSON.stringify({ error: `Slug "${cleanSlug}" is already in use by another report.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    body.slug = cleanSlug;
  }

  const updated = updateReport(id, body);

  logAudit({
    user_id: user?.id,
    action: 'report_updated',
    entity_type: 'report',
    entity_id: id,
    details: { title: updated.title, status: updated.status, slug: updated.slug },
  });

  return new Response(JSON.stringify({ success: true, report: updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) return new Response('Missing ID', { status: 400 });

  const existing = getReportById(id);
  if (!existing) return new Response('Not found', { status: 404 });

  const user = locals.user;
  deleteReport(id);

  logAudit({
    user_id: user?.id,
    action: 'report_deleted',
    entity_type: 'report',
    entity_id: id,
    details: { title: existing.title, slug: existing.slug },
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
