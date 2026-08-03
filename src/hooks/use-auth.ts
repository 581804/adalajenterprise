import { useQuery } from "@tanstack/react-query";
import { useSession as useMongoSession } from "@/integrations/mongodb/use-session";
import { getCurrentUser } from "@/integrations/mongodb/user.functions";

/**
 * Same exported shape as the original Supabase-backed hook: { session, user,
 * loading }. `session` is no longer a rich Supabase Session object — nothing
 * in this codebase actually reads it, only `user` and `loading`, so it's
 * kept here only for shape-compatibility, not because it's meaningfully used.
 */
export function useSession() {
  const { claims, isAuthenticated } = useMongoSession();
  return {
    session: isAuthenticated ? { user: claims } : null,
    user: isAuthenticated && claims ? { id: claims.sub, email: claims.email } : null,
    loading: false, // reading localStorage is synchronous — no loading state needed
  };
}

/**
 * Re-verifies admin status against the live DB on every call (not just the
 * JWT's cached role claim), so a role change since sign-in takes effect
 * immediately — matches the original's live `user_roles` table lookup.
 */
export function useIsAdmin(user: { id: string } | null | undefined) {
  return useQuery({
    queryKey: ["is_admin", user?.id ?? null],
    queryFn: async () => {
      if (!user) return false;
      try {
        const profile = await getCurrentUser();
        return profile.role === "admin";
      } catch {
        return false;
      }
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}
