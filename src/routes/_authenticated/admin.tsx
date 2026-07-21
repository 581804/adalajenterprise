import { createFileRoute, Link, Outlet, useRouterState, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Package,
  Folder,
  ShoppingCart,
  Users,
  Tag,
  Truck,
  Percent,
  Receipt,
  FileText,
  Palette,
  Settings,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Products", url: "/admin/products", icon: Package },
  { title: "Categories", url: "/admin/categories", icon: Folder },
  { title: "Orders", url: "/admin/orders", icon: ShoppingCart },
  { title: "Customers", url: "/admin/customers", icon: Users },
  { title: "Discounts", url: "/admin/discounts", icon: Tag },
  { title: "Shipping", url: "/admin/shipping", icon: Truck },
  { title: "Taxes", url: "/admin/taxes", icon: Percent },
  { title: "Fees", url: "/admin/fees", icon: Receipt },
  { title: "Pages", url: "/admin/pages", icon: FileText },
  { title: "Branding", url: "/admin/branding", icon: Palette },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

function AdminLayout() {
  const { user, loading } = useSession();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin(user);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !adminLoading && !isAdmin) {
      toast.error("Admin access required");
      navigate({ to: "/" });
    }
  }, [loading, adminLoading, isAdmin, navigate]);

  if (loading || adminLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!isAdmin) return null;

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                        <Link to={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/">
                    <ExternalLink className="h-4 w-4" />
                    <span>View store</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4 gap-3">
            <SidebarTrigger />
            <h1 className="font-semibold">Admin</h1>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
