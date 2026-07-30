import { createMiddleware } from "@tanstack/react-start";
import { getSessionToken } from "./session-store";

// Must be registered as a global `functionMiddleware` in `src/start.ts`;
// otherwise the browser never attaches the bearer token to serverFn RPCs.
// Replaces attachSupabaseAuth.
export const attachAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = getSessionToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});
