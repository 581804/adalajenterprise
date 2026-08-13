import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/components/cart-provider";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

import { getSiteSettings } from "@/integrations/mongodb/site-settings.functions";
import { buildSeoHead } from "@/lib/seo";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    // Root-level SEO fallback (used whenever a specific page doesn't
    // override title/description/image itself) now comes from the same
    // site_settings.seo the admin Branding screen already edits, instead
    // of being hardcoded here — this was the actual root cause of every
    // page sharing an identical title/description, and of a stale Lovable
    // preview-environment image URL surviving into production.
    const settings = await getSiteSettings().catch(() => null);
    return { settings };
  },
  head: ({ loaderData }) => {
    const settings = loaderData?.settings;
    const seo = settings?.seo as { title?: string; description?: string; og_image?: string } | undefined;
    const title = seo?.title?.trim() || settings?.brand_name || "Online Store";
    const description = seo?.description?.trim() || settings?.tagline || undefined;
    const image = seo?.og_image?.trim() || undefined;

    const { meta, links } = buildSeoHead({ title, description, image });
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...meta,
      ],
      links: [{ rel: "stylesheet", href: appCss }, ...links],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Client ID is safe to expose (it identifies the app to Google, it doesn't
// authenticate anything by itself) — only the Client Secret must stay
// server-side. Read via Vite's import.meta.env so it's inlined at build time.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // Fired by signOut()/notifySessionChanged() in use-session.ts, plus the
    // native `storage` event for cross-tab sign-out — replaces Supabase's
    // built-in onAuthStateChange.
    const handleSessionChange = () => {
      router.invalidate();
      queryClient.invalidateQueries();
    };
    window.addEventListener("session-token-changed", handleSessionChange);
    window.addEventListener("storage", handleSessionChange);
    return () => {
      window.removeEventListener("session-token-changed", handleSessionChange);
      window.removeEventListener("storage", handleSessionChange);
    };
  }, [router, queryClient]);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <CartProvider>
          <Outlet />
          <Toaster />
        </CartProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
