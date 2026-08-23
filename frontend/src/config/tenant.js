// Detect the college (tenant) from the URL.
// LOCAL (subdomain mode):  uos.localhost      → college "uos";  localhost → platform
// SERVER (path mode):      /cms/uos/...       → college "uos";  /cms/      → platform
//
// It auto-detects the mode: if the path starts with the base segment ("cms"),
// it reads the college from the path; otherwise it reads from the subdomain.

// The base path segment the app lives under on the server. Empty locally.
// On the server build we set this to "cms".
export const BASE_PATH = import.meta.env.VITE_BASE_PATH || '';

function getFromSubdomain() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return null;
  if (host.endsWith('.localhost')) return host.split('.')[0];
  const parts = host.split('.');
  if (parts.length <= 2) return null;
  return parts[0];
}

function getFromPath() {
  // pathname like "/cms/uos/portal/..." or "/cms/" or "/cms/colleges"
  let path = window.location.pathname;
  // strip the leading "/cms"
  if (BASE_PATH) {
    const prefix = '/' + BASE_PATH;
    if (path.startsWith(prefix)) path = path.slice(prefix.length);
  }
  // now path is "/uos/portal/..." or "/" or "/colleges"
  const segments = path.split('/').filter(Boolean); // ["uos","portal",...] or []
  const first = segments[0] || null;

  // Words that are NOT a college — they belong to the platform site
  const platformRoutes = ['colleges', 'login', 'register-college', 'portal',
                          'forgot-password', 'reset-password'];
  if (!first || platformRoutes.includes(first)) return null;
  return first;
}

export function getSubdomain() {
  // If we have a BASE_PATH (server, path mode), read the college from the path.
  // Otherwise (local), read from the subdomain.
  return BASE_PATH ? getFromPath() : getFromSubdomain();
}

export const IS_MAIN_DOMAIN = getSubdomain() === null;