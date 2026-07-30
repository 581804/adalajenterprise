import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSessionToken } from "@/integrations/mongodb/session-store";
import { getCurrentUser } from "@/integrations/mongodb/user.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = getSessionToken();
    if (!token) throw redirect({ to: "/auth" });

    // Re-verify server-side rather than trusting the client-decoded token —
    // this also catches a token whose user was deleted/role-changed since
    // it was issued, since getCurrentUser re-reads from MongoDB.
    try {
      const user = await getCurrentUser();
      return { user };
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
