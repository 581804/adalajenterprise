import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);
      const roleMap = new Map<string, string[]>();
      roles?.forEach((r) => { const l = roleMap.get(r.user_id) ?? []; l.push(r.role); roleMap.set(r.user_id, l); });
      return (profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      if (isAdmin) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "customers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Customers</h1>
      <div className="border rounded-lg divide-y">
        {users?.map((u) => (
          <div key={u.id} className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium">{u.full_name ?? "(no name)"}</div>
              <div className="text-xs text-muted-foreground">{u.email} · {u.roles.join(", ") || "customer"}</div>
            </div>
            <Button variant={u.roles.includes("admin") ? "destructive" : "outline"} size="sm" onClick={() => toggleAdmin.mutate({ userId: u.id, isAdmin: u.roles.includes("admin") })}>
              {u.roles.includes("admin") ? "Revoke admin" : "Make admin"}
            </Button>
          </div>
        ))}
        {!users?.length ? <p className="p-8 text-center text-muted-foreground">No customers yet.</p> : null}
      </div>
    </div>
  );
}
