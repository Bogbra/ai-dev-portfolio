/**
 * Guards against non-http(s) schemes (e.g. javascript:) in externally
 * sourced URLs (Tavily search results) before they reach an <a href> —
 * React does not sanitise href itself. The backend already filters these,
 * this is defense-in-depth for the same data.
 */
export function isSafeExternalUrl(url: string | undefined | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
