import type { APIRoute } from 'astro';
import { getPublishedReports } from '../../lib/db.ts';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category') || undefined;

  const { reports, total } = getPublishedReports({
    search: query,
    categorySlug: category,
    limit: 20,
  });

  const minimalResults = reports.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    summary: r.summary,
    category: r.category_name,
    date: r.published_at || r.created_at.slice(0, 10),
    readingTime: r.reading_time_minutes,
  }));

  return new Response(JSON.stringify({ results: minimalResults, total }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
};
