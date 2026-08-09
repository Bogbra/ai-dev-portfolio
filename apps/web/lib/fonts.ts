import { Geist, Inter, IBM_Plex_Mono } from 'next/font/google';

// Headlines: Geist Sans variable — Vercel's geometric sans, clean and precise.
// Variable font: full weight range (100–900) available, including 650 and 800.
export const fontDisplay = Geist({
  subsets: ['latin'],
  variable: '--font-display-var',
  display: 'swap',
  preload: true,
});

// Body + UI: Inter — neutral, highly legible, standard for dense UI text.
export const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans-var',
  weight: ['400', '500', '600'],
  display: 'swap',
  preload: true,
});

// Labels, eyebrows, code, nav metadata: IBM Plex Mono.
export const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono-var',
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
});
