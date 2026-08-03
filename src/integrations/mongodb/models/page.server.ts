// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const pageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    seo: { type: Schema.Types.Mixed, default: {} },
    isPublished: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

export type PageDocument = InferSchemaType<typeof pageSchema>;

export const Page: Model<PageDocument> =
  (mongoose.models.Page as Model<PageDocument>) || mongoose.model("Page", pageSchema);
