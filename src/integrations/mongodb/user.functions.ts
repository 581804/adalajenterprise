import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";

/**
 * Returns the authenticated user's current DB record (fresh, not just the
 * JWT's cached claims) — so a role change or account deletion made after the
 * session token was issued is reflected immediately, the same guarantee
 * Supabase's auth.getUser() gave by hitting the auth server on each call.
 */
export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { connectMongo } = await import("./client.server");
    const { User } = await import("./models/user.server");

    await connectMongo();
    const user = await User.findById(context.userId).lean();
    if (!user) {
      throw new Error("Unauthorized: User not found");
    }

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  });
