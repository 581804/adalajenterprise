import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";
import { DEFAULT_CURRENCY } from "@/lib/format";

function serializeVariant(v: any) {
  return {
    id: v._id.toString(),
    name: v.name,
    sku: v.sku ?? null,
    price_cents: v.priceCents ?? null,
    stock: v.stock,
    option_values: v.optionValues ?? {},
    image_url: v.imageUrl ?? null,
    sort_order: v.sortOrder,
  };
}

function serializeProduct(p: any, opts: { includeVariants?: boolean } = {}) {
  const base = {
    id: p._id.toString(),
    slug: p.slug,
    title: p.title,
    description: p.description ?? "",
    short_description: p.shortDescription ?? null,
    price_cents: p.priceCents,
    compare_at_cents: p.compareAtCents ?? null,
    currency: p.currency,
    category_id: p.categoryId ? p.categoryId.toString() : null,
    status: p.status,
    images: p.images ?? [],
    tags: p.tags ?? [],
    stock: p.stock,
    sku: p.sku ?? null,
    weight_grams: p.weightGrams ?? null,
    seo: p.seo ?? {},
    is_featured: p.isFeatured,
    tax_rate_id: p.taxRateId ? p.taxRateId.toString() : null,
    price_includes_tax: p.priceIncludesTax,
    fee_category_id: p.feeCategoryId ? p.feeCategoryId.toString() : null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
  if (opts.includeVariants) {
    return { ...base, product_variants: (p.variants ?? []).map(serializeVariant) };
  }
  return { ...base, product_variants: undefined as ReturnType<typeof serializeVariant>[] | undefined };
}

export type ProductWithVariants = ReturnType<typeof serializeProduct> & {
  product_variants: ReturnType<typeof serializeVariant>[];
};

const listInput = z.object({
  status: z.enum(["draft", "active", "archived"]).optional(),
  featured: z.boolean().optional(),
  categoryId: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  limit: z.number().max(100).optional(),
});

/**
 * Public product listing — covers every storefront query pattern seen
 * across index.tsx (featured/recent), shop.index.tsx (filter+sort), and
 * shop.$category.tsx (by category) in one flexible function rather than
 * three near-duplicates.
 */
export const listProducts = createServerFn({ method: "GET" })
  .validator(listInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Product } = await import("./models/product.server");
    await connectMongo();

    const filter: Record<string, unknown> = { status: data.status ?? "active" };
    if (data.featured) filter.isFeatured = true;
    if (data.categoryId) filter.categoryId = data.categoryId;

    let sortSpec: Record<string, 1 | -1> = { createdAt: -1 };
    if (data.sort === "price_asc") sortSpec = { priceCents: 1 };
    if (data.sort === "price_desc") sortSpec = { priceCents: -1 };

    const products = await Product.find(filter)
      .sort(sortSpec)
      .limit(data.limit ?? 60)
      .lean();
    return products.map((p) => serializeProduct(p));
  });

/** Public: single product by slug, with variants, for the product detail page. */
export const getProductBySlug = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }): Promise<ProductWithVariants | null> => {
    const { connectMongo } = await import("./client.server");
    const { Product } = await import("./models/product.server");
    await connectMongo();
    const product = await Product.findOne({ slug: data.slug }).lean();
    return product ? (serializeProduct(product, { includeVariants: true }) as ProductWithVariants) : null;
  });

/**
 * Batch lookup by IDs, returning tax/fee join data — replaces the checkout
 * page's `.select("id, tax_rate_id, ..., tax_rates:tax_rate_id(...), ...")`
 * Supabase embedded-join query. Mongo has no server-side join syntax as
 * clean as PostgREST's, so this does the two lookups and stitches them here.
 */
export const getProductCheckoutMeta = createServerFn({ method: "GET" })
  .validator(z.object({ productIds: z.array(z.string()) }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Product } = await import("./models/product.server");
    const { TaxRate } = await import("./models/tax-rate.server");
    const { FeeCategory } = await import("./models/fee-category.server");
    await connectMongo();

    const products = await Product.find({ _id: { $in: data.productIds } })
      .select("_id taxRateId priceIncludesTax feeCategoryId")
      .lean();

    const taxRateIds = [...new Set(products.map((p) => p.taxRateId?.toString()).filter(Boolean))];
    const feeCategoryIds = [...new Set(products.map((p) => p.feeCategoryId?.toString()).filter(Boolean))];

    const [taxRates, feeCategories] = await Promise.all([
      TaxRate.find({ _id: { $in: taxRateIds } }).lean(),
      FeeCategory.find({ _id: { $in: feeCategoryIds } }).lean(),
    ]);
    const taxRateById = new Map(taxRates.map((t) => [t._id.toString(), t]));
    const feeCategoryById = new Map(feeCategories.map((f) => [f._id.toString(), f]));

    return products.map((p) => {
      const taxRate = p.taxRateId ? taxRateById.get(p.taxRateId.toString()) : null;
      const feeCategory = p.feeCategoryId ? feeCategoryById.get(p.feeCategoryId.toString()) : null;
      return {
        id: p._id.toString(),
        tax_rate_id: p.taxRateId?.toString() ?? null,
        price_includes_tax: p.priceIncludesTax,
        fee_category_id: p.feeCategoryId?.toString() ?? null,
        tax_rates: taxRate ? { id: taxRate._id.toString(), name: taxRate.name, rate_percent: taxRate.ratePercent } : null,
        fee_categories: feeCategory
          ? {
              id: feeCategory._id.toString(),
              name: feeCategory.name,
              amount_cents: feeCategory.amountCents,
              percent: feeCategory.percent,
              scope: feeCategory.scope,
              taxable: feeCategory.taxable,
              tax_rate_id: feeCategory.taxRateId?.toString() ?? null,
            }
          : null,
      };
    });
  });

/** Admin: list all products regardless of status, for the admin product table. */
export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { Product } = await import("./models/product.server");
    await connectMongo();
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    return products.map((p) => serializeProduct(p));
  });

export const adminGetProduct = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<ProductWithVariants | null> => {
    const { connectMongo } = await import("./client.server");
    const { Product } = await import("./models/product.server");
    await connectMongo();
    const product = await Product.findById(data.id).lean();
    return product ? (serializeProduct(product, { includeVariants: true }) as ProductWithVariants) : null;
  });

const variantInput = z.object({
  id: z.string().optional(),
  name: z.string(),
  sku: z.string().optional().nullable(),
  price_cents: z.number().optional().nullable(),
  stock: z.number(),
  option_values: z.record(z.string()).optional(),
  image_url: z.string().optional().nullable(),
  sort_order: z.number().optional(),
});

const productInput = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  short_description: z.string().optional().nullable(),
  price_cents: z.number().min(0),
  compare_at_cents: z.number().optional().nullable(),
  currency: z.string().optional(),
  category_id: z.string().optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  images: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  stock: z.number().min(0).optional(),
  sku: z.string().optional().nullable(),
  weight_grams: z.number().optional().nullable(),
  seo: z.record(z.unknown()).optional(),
  is_featured: z.boolean().optional(),
  tax_rate_id: z.string().optional().nullable(),
  price_includes_tax: z.boolean().optional(),
  fee_category_id: z.string().optional().nullable(),
  variants: z.array(variantInput).optional(),
});

function toProductDoc(data: z.infer<typeof productInput>, fallbackCurrency: string) {
  return {
    slug: data.slug,
    title: data.title,
    description: data.description ?? "",
    shortDescription: data.short_description ?? undefined,
    priceCents: data.price_cents,
    compareAtCents: data.compare_at_cents ?? undefined,
    currency: data.currency ?? fallbackCurrency,
    categoryId: data.category_id || null,
    status: data.status ?? "draft",
    images: data.images ?? [],
    tags: data.tags ?? [],
    stock: data.stock ?? 0,
    sku: data.sku ?? undefined,
    weightGrams: data.weight_grams ?? undefined,
    seo: data.seo ?? {},
    isFeatured: data.is_featured ?? false,
    taxRateId: data.tax_rate_id || null,
    priceIncludesTax: data.price_includes_tax ?? false,
    feeCategoryId: data.fee_category_id || null,
    variants: (data.variants ?? []).map((v) => ({
      _id: v.id,
      name: v.name,
      sku: v.sku ?? undefined,
      priceCents: v.price_cents ?? undefined,
      stock: v.stock,
      optionValues: v.option_values ?? {},
      imageUrl: v.image_url ?? undefined,
      sortOrder: v.sort_order ?? 0,
    })),
  };
}

export const adminCreateProduct = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(productInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Product } = await import("./models/product.server");
    const { getOrCreateSiteSettings } = await import("./models/site-settings.server");
    await connectMongo();
    const settings = await getOrCreateSiteSettings();
    const created = await Product.create(toProductDoc(data, settings.currency || DEFAULT_CURRENCY));
    return serializeProduct(created, { includeVariants: true });
  });

export const adminUpdateProduct = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(productInput.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Product } = await import("./models/product.server");
    const { getOrCreateSiteSettings } = await import("./models/site-settings.server");
    await connectMongo();
    const settings = await getOrCreateSiteSettings();
    const { id, ...rest } = data;
    const updated = await Product.findByIdAndUpdate(id, toProductDoc(rest, settings.currency || DEFAULT_CURRENCY), { new: true });
    if (!updated) throw new Error("Product not found");
    return serializeProduct(updated, { includeVariants: true });
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Product } = await import("./models/product.server");
    await connectMongo();
    await Product.findByIdAndDelete(data.id);
    return { success: true };
  });
