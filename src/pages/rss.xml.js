import rss from '@astrojs/rss';
import { getPublishedReports, getSiteSettings } from '../lib/db.ts';

export async function GET(context) {
  const settings = getSiteSettings();
  const { reports } = getPublishedReports({ limit: 50 });

  return rss({
    title: settings.site_title,
    description: settings.site_description,
    site: context.site || 'https://oserved.com',
    items: reports.map((report) => ({
      title: report.title,
      description: report.summary,
      pubDate: report.published_at ? new Date(report.published_at) : new Date(report.created_at),
      link: `/research/${report.slug}`,
      categories: [report.category_name],
      author: report.author,
    })),
    customData: `<language>en-us</language>`,
  });
}
