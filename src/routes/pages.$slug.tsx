import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPageBySlug } from "@/integrations/mongodb/page.functions";
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
      const result = await getPageBySlug({ data: { slug } });
      if (!result) throw notFound();
      return result;
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
