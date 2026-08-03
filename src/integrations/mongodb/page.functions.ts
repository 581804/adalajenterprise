import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";

function serializePage(p: any) {
  return {
    id: p._id.toString(),
    slug: p.slug,
    title: p.title,
    body: p.body ?? "",
    seo: p.seo ?? {},
    is_published: p.isPublished,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

/** Public: a single published page by slug. Returns null if not found or unpublished. */
export const getPageBySlug = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Page } = await import("./models/page.server");
    await connectMongo();
    const page = await Page.findOne({ slug: data.slug, isPublished: true }).lean();
    return page ? serializePage(page) : null;
  });

export const adminListPages = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { Page } = await import("./models/page.server");
    await connectMongo();
    const pages = await Page.find().sort({ title: 1 }).lean();
    return pages.map(serializePage);
  });

export const adminGetPage = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Page } = await import("./models/page.server");
    await connectMongo();
    const page = await Page.findById(data.id).lean();
    return page ? serializePage(page) : null;
  });

const pageInput = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  seo: z.record(z.unknown()).optional(),
  is_published: z.boolean().optional(),
});

export const adminCreatePage = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(pageInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Page } = await import("./models/page.server");
    await connectMongo();
    const created = await Page.create({
      slug: data.slug,
      title: data.title,
      body: data.body ?? "",
      seo: data.seo ?? {},
      isPublished: data.is_published ?? true,
    });
    return serializePage(created);
  });

export const adminUpdatePage = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(pageInput.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Page } = await import("./models/page.server");
    await connectMongo();
    const { id, ...rest } = data;
    const updated = await Page.findByIdAndUpdate(
      id,
      { slug: rest.slug, title: rest.title, body: rest.body ?? "", seo: rest.seo ?? {}, isPublished: rest.is_published ?? true },
      { new: true },
    );
    if (!updated) throw new Error("Page not found");
    return serializePage(updated);
  });

export const adminDeletePage = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Page } = await import("./models/page.server");
    await connectMongo();
    await Page.findByIdAndDelete(data.id);
    return { success: true };
  });
