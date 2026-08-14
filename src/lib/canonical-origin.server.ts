// Server-only logic, but exposed via createServerFn — a route loader is
// itself bundled into the CLIENT build too (so client-side navigations can
// re-run it without a full reload), so a plain function in a .server.ts
// file imported by a loader still gets pulled into the client bundle
// regardless of filename. createServerFn is the actual enforcement
// boundary here: it compiles to a real RPC call from the client, keeping
// the server-only import genuinely server-side. Confirmed by hitting
// exactly this build failure with the plain-function version first.
import { createServerFn } from "@tanstack/react-start";

export const getCanonicalOrigin = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) return undefined;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
});
