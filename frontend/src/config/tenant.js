// Detect whether we're on the platform's main domain or a college subdomain.
// Dev:  localhost         → main (platform)
//       uos.localhost     → subdomain "uos" (college)
// Prod: yourplatform.com  → main
//       college.yourplatform.com → subdomain "college"
export function getSubdomain() {
  const host = window.location.hostname; // e.g. "uos.localhost" or "localhost"
  const parts = host.split('.');

  // localhost (1 part) → main domain, no subdomain
  // uos.localhost (2 parts) → subdomain "uos"
  // yourplatform.com (2 parts) → main; college.yourplatform.com (3) → subdomain
  // We treat the LAST part (localhost / com) as the base.
  if (host === 'localhost' || host === '127.0.0.1') return null;

  // Ends with .localhost → dev subdomain
  if (host.endsWith('.localhost')) {
    return parts[0]; // "uos"
  }

  // Production: adjust "yourplatform" to your real base domain later.
  // For now, assume 2-part = main, 3-part = subdomain.
  if (parts.length <= 2) return null;      // yourplatform.com → main
  return parts[0];                          // college.yourplatform.com → "college"
}

export const IS_MAIN_DOMAIN = getSubdomain() === null;