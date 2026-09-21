import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Fresh cryptographically random nonce per request.
  // Only scripts carrying this nonce may execute.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env['NODE_ENV'] === 'development';

  const cspDirectives = [
    `default-src 'self'`,

    // Scripts: only allowed with a matching nonce.
    // 'strict-dynamic' permits dynamically loaded scripts that are loaded by a nonced script
    // — required for Next.js internal module chunks.
    // In development: 'unsafe-eval' for Hot Module Replacement (Webpack/Turbopack).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,

    // Styles: 'unsafe-inline' is required because motion/react injects inline styles
    // at runtime (for animation states) and Next.js delivers critical CSS inline.
    // CSS injection is considerably less dangerous than script injection.
    `style-src 'self' 'unsafe-inline'`,

    // Images: data: for inline SVGs/Base64, blob: for dynamically generated images
    `img-src 'self' data: blob:`,

    // Fonts: own server only (next/font optimises and self-hosts)
    `font-src 'self'`,

    // API calls: own server + both backends (omitted when env var is not set)
    ['connect-src', "'self'", process.env['NEXT_PUBLIC_API_URL'], process.env['NEXT_PUBLIC_AI_URL']].filter(Boolean).join(' '),

    `media-src 'self' data: blob:`,
    `object-src 'none'`,

    // Prevents embedding in third-party iframes (clickjacking protection)
    `frame-ancestors 'none'`,

    `base-uri 'self'`,
    `form-action 'self'`,

    // Automatically upgrade HTTP resources to HTTPS (relevant in production only)
    `upgrade-insecure-requests`,
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  // Forward the nonce to the layout component via header
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', cspDirectives);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('content-security-policy', cspDirectives);

  // Additional security headers — complementing next.config.ts
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('permissions-policy', 'camera=(), microphone=(self), geolocation=()');

  return response;
}

export const config = {
  // Apply middleware to all routes; exclude static assets and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
