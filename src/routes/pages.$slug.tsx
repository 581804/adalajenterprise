import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/pages/$slug")({
  component: CmsPage,
});

function CmsPage() {
  const { slug } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["page", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("pages").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        {data ? (
          <>
            <h1 className="text-4xl font-bold mb-6">{data.title}</h1>
            <div className="prose max-w-none whitespace-pre-wrap">{data.body}</div>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
