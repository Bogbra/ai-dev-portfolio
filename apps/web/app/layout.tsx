import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Analytics } from '@vercel/analytics/next';
import { fontDisplay, fontSans, fontMono } from '@/lib/fonts';
import { MotionProvider } from '@/components/motion/index';
import { DotGridSpotlight } from '@/components/motion/DotGridSpotlight';
import { LangProvider } from '@/lib/i18n';
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import '../styles/globals.css';

const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';
const title = 'Agentic AI Engineering Portfolio';
const description =
  'Agentic AI Engineer building multi-agent workflows, RAG systems, and an MCP server — built with evaluation, guardrails, testing, and production-minded constraints.';

export const metadata: Metadata = {
  title: {
    template: '%s — Agentic AI Engineering Portfolio',
    default: title,
  },
  description,
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: '/',
    title,
    description,
    siteName: 'Agentic AI Engineering Portfolio',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/opengraph-image'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {nonce && <meta property="csp-nonce" content={nonce} />}
        {/* Prevent theme flash: read stored preference before first paint */}
        <script
          nonce={nonce || undefined}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
        {/* Set html.lang before first paint so screen readers see correct language immediately */}
        <script
          nonce={nonce || undefined}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('lang');if(l!=='en'&&l!=='de')l=navigator.language.toLowerCase().startsWith('de')?'de':'en';document.documentElement.lang=l;}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <DotGridSpotlight />
        <LangProvider>
          <MotionProvider>
            <Nav />
            {children}
            <Footer />
          </MotionProvider>
        </LangProvider>
        <Analytics />
      </body>
    </html>
  );
}
