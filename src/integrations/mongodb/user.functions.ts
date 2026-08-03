import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth-middleware";

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

/** Admin: all customers, for the admin customers screen and dashboard counts. */
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { User } = await import("./models/user.server");
    await connectMongo();
    const users = await User.find().sort({ createdAt: -1 }).lean();
    return users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      full_name: u.name,
      phone: u.phone ?? null,
      avatar_url: u.avatarUrl ?? null,
      is_admin: u.role === "admin",
      created_at: u.createdAt,
    }));
  });

/** Admin: promote/demote a user's role. Used by the customers screen's "Make admin"/"Revoke admin" toggle. */
export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ userId: z.string(), role: z.enum(["customer", "admin"]) }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { User } = await import("./models/user.server");
    await connectMongo();
    const updated = await User.findByIdAndUpdate(data.userId, { role: data.role }, { new: true });
    if (!updated) throw new Error("User not found");
    return { success: true };
  });
