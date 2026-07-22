import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/account")({
  component: Account,
});

function Account() {
  const { user } = useSession();
  const navigate = useNavigate();

  const { data: orders } = useQuery({
    queryKey: ["account", "orders", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("orders").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">My account</h1>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>

        <section>
          <h2 className="text-xl font-semibold mb-3">Order history</h2>
          <div className="border rounded-lg divide-y">
            {orders?.length ? orders.map((o) => (
              <Link
                key={o.id}
                to="/account/orders/$id"
                params={{ id: o.id }}
                className="p-4 flex justify-between hover:bg-muted/40 transition"
              >
                <div>
                  <div className="font-medium">{o.order_number}</div>
                  <div className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()} · <span className="capitalize">{o.status}</span></div>
                </div>
                <div className="font-medium">{formatMoney(o.total_cents, o.currency)}</div>
              </Link>
            )) : <p className="p-8 text-center text-muted-foreground">No orders yet.</p>}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
