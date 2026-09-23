import type { Metadata } from 'next';

/**
 * Next.js metadata fields are inherited from the parent layout only when a
 * route's own metadata object omits that field entirely — but a route that
 * DOES define its own `openGraph` or `twitter` object has that object
 * replace the parent's outright, not merge with it field-by-field. Every
 * case-study page/route.tsx defined its own `openGraph` (title/description/
 * type only) without `url`, `siteName`, or `images`, and no `alternates` or
 * `twitter` block at all — so each case study silently inherited the
 * homepage's `alternates.canonical: '/'` (claiming `/` as its own canonical
 * URL) and the homepage's `twitter` card (wrong title/description/image
 * when shared on Twitter/X). This builder makes every field explicit so a
 * case-study page's metadata can never silently fall back to the
 * homepage's.
 */
export function createCaseStudyMetadata({
  slug,
  title,
  description,
  ogTitle,
  ogDescription,
}: {
  slug: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
}): Metadata {
  const url = `/work/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: ogTitle,
      description: ogDescription,
      siteName: 'AI Systems Showcase',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: ['/opengraph-image'],
    },
  };
}
