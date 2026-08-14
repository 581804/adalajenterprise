import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPageBySlug } from "@/integrations/mongodb/page.functions";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buildSeoHead, stripHtmlForMeta } from "@/lib/seo";
import { getCanonicalOrigin } from "@/lib/canonical-origin.server";
import { SanitizedHtml } from "@/components/sanitized-html";

export const Route = createFileRoute("/pages/$slug")({
  loader: async ({ params }) => {
    const [page, canonicalOrigin] = await Promise.all([
      getPageBySlug({ data: { slug: params.slug } }),
      getCanonicalOrigin(),
    ]);
    if (!page) throw notFound();
    return { page, canonicalOrigin };
  },
  head: ({ loaderData }) => {
    const page = loaderData?.page;
    if (!page) return {};
    const seo = (page.seo ?? {}) as { title?: string; description?: string };
    const url = loaderData?.canonicalOrigin ? `${loaderData.canonicalOrigin}/pages/${page.slug}` : undefined;
    const { meta, links } = buildSeoHead({
      title: seo.title?.trim() || page.title,
      description: seo.description?.trim() || (page.body ? stripHtmlForMeta(page.body) : undefined),
      url,
    });
    return { meta, links };
  },
  component: CmsPage,
});

function CmsPage() {
  const { slug } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const { data } = useQuery({
    queryKey: ["page", slug],
    initialData: loaderData.page,
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
            <div className="prose max-w-none">
              <SanitizedHtml html={data.body} variant="page" />
            </div>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
