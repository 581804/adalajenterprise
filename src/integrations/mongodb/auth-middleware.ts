import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { verifySessionToken } from "./auth.server";

/**
 * Replaces requireSupabaseAuth. Expects `Authorization: Bearer <sessionToken>`
 * where sessionToken was issued by signInWithGoogleIdToken(). On success,
 * attaches { userId, role, claims } to context — same shape server functions
 * previously read from the Supabase middleware (userId), plus `role` for
 * admin checks that used to rely on RLS policies against user_roles.
 */
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();

  if (!request?.headers) {
    throw new Error("Unauthorized: No request headers available");
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    throw new Error("Unauthorized: No authorization header provided");
  }
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Only Bearer tokens are supported");
  }

  const token = authHeader.slice("Bearer ".length);
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }

  let claims;
  try {
    claims = verifySessionToken(token);
  } catch {
    throw new Error("Unauthorized: Invalid token");
  }

  return next({
    context: {
      userId: claims.sub,
      role: claims.role,
      claims,
    },
  });
});

/**
 * Admin-only guard. Declares requireAuth as a dependency via .middleware()
 * so `context.role` is correctly typed (not just cast) and so using
 * requireAdmin alone on a server function is enough — it pulls requireAuth
 * in automatically rather than relying on call-site ordering.
 * Replaces the app-level authorization RLS policies used to provide via
 * user_roles.
 */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    if (context.role !== "admin") {
      throw new Error("Forbidden: Admin role required");
    }
    return next();
  });
