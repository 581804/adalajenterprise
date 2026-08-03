// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const taxRateSchema = new Schema(
  {
    name: { type: String, required: true },
    country: { type: String, required: true },
    region: { type: String },
    ratePercent: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

export type TaxRateDocument = InferSchemaType<typeof taxRateSchema>;

export const TaxRate: Model<TaxRateDocument> =
  (mongoose.models.TaxRate as Model<TaxRateDocument>) || mongoose.model("TaxRate", taxRateSchema);
