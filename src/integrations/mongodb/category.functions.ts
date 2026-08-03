import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";

function serializeCategory(c: any) {
  return {
    id: c._id.toString(),
    slug: c.slug,
    name: c.name,
    description: c.description ?? null,
    image_url: c.imageUrl ?? null,
    parent_id: c.parentId ? c.parentId.toString() : null,
    sort_order: c.sortOrder,
    is_active: c.isActive,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

/** Public: active categories only, matching `.eq("is_active", true)` callers. */
export const listActiveCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { connectMongo } = await import("./client.server");
  const { Category } = await import("./models/category.server");
  await connectMongo();
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  return categories.map(serializeCategory);
});

/** Public: single category by slug. Returns null if not found (caller throws notFound()). */
export const getCategoryBySlug = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Category } = await import("./models/category.server");
    await connectMongo();
    const category = await Category.findOne({ slug: data.slug }).lean();
    return category ? serializeCategory(category) : null;
  });

/** Admin: full list including inactive, for the admin categories screen. */
export const adminListCategories = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { Category } = await import("./models/category.server");
    await connectMongo();
    const categories = await Category.find().sort({ sortOrder: 1 }).lean();
    return categories.map(serializeCategory);
  });

const categoryInput = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  parent_id: z.string().optional().nullable(),
  sort_order: z.number().optional(),
  is_active: z.boolean().optional(),
});

export const adminCreateCategory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(categoryInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Category } = await import("./models/category.server");
    await connectMongo();
    const created = await Category.create({
      slug: data.slug,
      name: data.name,
      description: data.description ?? undefined,
      imageUrl: data.image_url ?? undefined,
      parentId: data.parent_id ?? null,
      sortOrder: data.sort_order ?? 0,
      isActive: data.is_active ?? true,
    });
    return serializeCategory(created);
  });

export const adminUpdateCategory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(categoryInput.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Category } = await import("./models/category.server");
    await connectMongo();
    const { id, ...rest } = data;
    const updated = await Category.findByIdAndUpdate(
      id,
      {
        slug: rest.slug,
        name: rest.name,
        description: rest.description ?? undefined,
        imageUrl: rest.image_url ?? undefined,
        parentId: rest.parent_id ?? null,
        sortOrder: rest.sort_order,
        isActive: rest.is_active,
      },
      { new: true },
    );
    if (!updated) throw new Error("Category not found");
    return serializeCategory(updated);
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Category } = await import("./models/category.server");
    await connectMongo();
    // Original: parent_id REFERENCES categories(id) ON DELETE SET NULL.
    // Mongo has no cascade equivalent — replicate it explicitly here so
    // child categories don't end up pointing at a deleted parent.
    await Category.updateMany({ parentId: data.id }, { $set: { parentId: null } });
    await Category.findByIdAndDelete(data.id);
    return { success: true };
  });
