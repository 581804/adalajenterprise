// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const categorySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    imageUrl: { type: String },
    // Self-reference for subcategories. ON DELETE SET NULL in Postgres ->
    // handled in application code (see category.functions.ts delete handler)
    // since Mongo has no equivalent cascade/set-null-on-delete for refs.
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export type CategoryDocument = InferSchemaType<typeof categorySchema>;

export const Category: Model<CategoryDocument> =
  (mongoose.models.Category as Model<CategoryDocument>) || mongoose.model("Category", categorySchema);
