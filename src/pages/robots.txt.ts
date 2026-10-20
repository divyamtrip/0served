import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const content = `# 0served Search Engine Directives
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin
Disallow: /uploads/temp

Sitemap: https://oserved.com/sitemap-index.xml
`;

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
