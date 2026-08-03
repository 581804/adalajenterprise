import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListUsers, adminSetUserRole } from "@/integrations/mongodb/user.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => adminListUsers(),
  });

  const toggleAdmin = useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      adminSetUserRole({ data: { userId, role: isAdmin ? "customer" : "admin" } }),
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
              <div className="text-xs text-muted-foreground">{u.email} · {u.is_admin ? "admin" : "customer"}</div>
            </div>
            <Button variant={u.is_admin ? "destructive" : "outline"} size="sm" onClick={() => toggleAdmin.mutate({ userId: u.id, isAdmin: u.is_admin })}>
              {u.is_admin ? "Revoke admin" : "Make admin"}
            </Button>
          </div>
        ))}
        {!users?.length ? <p className="p-8 text-center text-muted-foreground">No customers yet.</p> : null}
      </div>
    </div>
  );
}
