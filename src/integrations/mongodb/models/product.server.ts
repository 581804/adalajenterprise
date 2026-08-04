// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { DEFAULT_CURRENCY } from "@/lib/format";

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

// Embedded — a variant never exists independently of its product, and is
// always read/written alongside it (was product_variants, a separate table
// with its own RLS policy mirroring the parent product's status).
const productVariantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    priceCents: { type: Number, min: 0 }, // null/undefined = falls back to product price
    stock: { type: Number, required: true, default: 0, min: 0 },
    optionValues: { type: Schema.Types.Mixed, default: {} }, // e.g. { size: "M", color: "Red" }
    imageUrl: { type: String },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    shortDescription: { type: String },
    priceCents: { type: Number, required: true, default: 0, min: 0 },
    compareAtCents: { type: Number, min: 0 },
    currency: { type: String, required: true, default: DEFAULT_CURRENCY },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", index: true },
    status: { type: String, enum: PRODUCT_STATUSES, required: true, default: "draft", index: true },
    images: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    stock: { type: Number, required: true, default: 0, min: 0 },
    sku: { type: String, trim: true },
    weightGrams: { type: Number, min: 0 },
    seo: { type: Schema.Types.Mixed, default: {} },
    isFeatured: { type: Boolean, default: false },
    taxRateId: { type: Schema.Types.ObjectId, ref: "TaxRate" },
    priceIncludesTax: { type: Boolean, default: false },
    feeCategoryId: { type: Schema.Types.ObjectId, ref: "FeeCategory" },
    variants: { type: [productVariantSchema], default: [] },
  },
  { timestamps: true },
);

// Compound index supporting the most common storefront query: active
// products in a given category, newest first — mirrors products_status_idx
// and products_category_idx from the original migration, combined since
// they're almost always filtered together.
productSchema.index({ status: 1, categoryId: 1, createdAt: -1 });

export type ProductDocument = InferSchemaType<typeof productSchema>;

export const Product: Model<ProductDocument> =
  (mongoose.models.Product as Model<ProductDocument>) || mongoose.model("Product", productSchema);
