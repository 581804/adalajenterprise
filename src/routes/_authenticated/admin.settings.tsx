import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: () => (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted-foreground">
        Store branding, navigation, banners, currency, and SEO defaults are managed in{" "}
        <Link to="/admin/branding" className="underline">Branding & site settings</Link>.
      </p>
      <p className="text-muted-foreground text-sm">
        Payments provider setup will appear here when enabled.
      </p>
    </div>
  ),
});
