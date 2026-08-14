// Server-only.
//
// Deliberately NOT a static public/robots.txt file: that file can only ever
// contain one hardcoded domain, which breaks the moment this codebase is
// deployed for a different client on a different domain. Generating this
// from the actual incoming request's own host is correct for any
// deployment automatically — no per-client configuration needed at all.
export function handleRobotsRequest(url: URL): Response {
  const origin = `${url.protocol}//${url.host}`;
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /account
Disallow: /checkout
Disallow: /auth

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
