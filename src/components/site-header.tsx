import { Link } from "@tanstack/react-router";
import { ShoppingBag, User as UserIcon, Menu } from "lucide-react";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";
import { useSession, useIsAdmin } from "@/hooks/use-auth";
import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export function SiteHeader() {
  const { data: settings } = useSiteSettingsOptional();
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user);
  const { itemCount } = useCart();

  const nav = settings?.header_nav?.length
    ? settings.header_nav
    : [
        { label: "Shop", url: "/shop" },
        { label: "About", url: "/pages/about" },
      ];

  return (
    <>
      {settings?.announcement?.enabled && settings.announcement.text ? (
        <div className="bg-primary text-primary-foreground text-center text-sm py-2 px-4">
          {settings.announcement.link ? (
            <a href={settings.announcement.link} className="underline">
              {settings.announcement.text}
            </a>
          ) : (
            settings.announcement.text
          )}
        </div>
      ) : null}
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <nav className="flex flex-col gap-4 pt-6">
                  {nav.map((n) => (
                    <a key={n.url} href={n.url} className="text-lg font-medium">
                      {n.label}
                    </a>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="" className="h-8 w-auto" />
              ) : null}
              <span>{settings?.brand_name ?? "My Store"}</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {nav.map((n) => (
                <a
                  key={n.url}
                  href={n.url}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin ? (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">Admin</Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="icon">
              <Link to={user ? "/account" : "/auth"}>
                <UserIcon className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="relative">
              <Link to="/cart">
                <ShoppingBag className="h-5 w-5" />
                {itemCount > 0 ? (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full h-5 w-5 text-xs flex items-center justify-center">
                    {itemCount}
                  </span>
                ) : null}
              </Link>
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
