// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const FEE_SCOPES = ["per_unit", "per_order"] as const;
export type FeeScope = (typeof FEE_SCOPES)[number];

const feeCategorySchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    amountCents: { type: Number, required: true, default: 0 },
    percent: { type: Number, required: true, default: 0 },
    scope: { type: String, enum: FEE_SCOPES, required: true, default: "per_unit" },
    taxable: { type: Boolean, required: true, default: false },
    taxRateId: { type: Schema.Types.ObjectId, ref: "TaxRate" },
    isActive: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

export type FeeCategoryDocument = InferSchemaType<typeof feeCategorySchema>;

export const FeeCategory: Model<FeeCategoryDocument> =
  (mongoose.models.FeeCategory as Model<FeeCategoryDocument>) ||
  mongoose.model("FeeCategory", feeCategorySchema);
