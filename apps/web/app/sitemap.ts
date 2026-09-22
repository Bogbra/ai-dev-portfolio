import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

// /impressum and /datenschutz are deliberately omitted — both set
// robots: { index: false, follow: false } (see their own page.tsx), so
// listing them here would contradict that.
const CASE_STUDY_SLUGS = [
  'ai-operations-workflow-agent',
  'research-to-post-multi-agent-workflow',
  'research-rag-assistant',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;

  return [
    { url: siteUrl, changeFrequency: 'monthly', priority: 1 },
    ...CASE_STUDY_SLUGS.map((slug) => ({
      url: `${siteUrl}/work/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
