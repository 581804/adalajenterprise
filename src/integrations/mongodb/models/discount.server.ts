// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const DISCOUNT_TYPES = ["percent", "fixed", "free_shipping"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

const discountSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String },
    type: { type: String, enum: DISCOUNT_TYPES, required: true, default: "percent" },
    value: { type: Number, required: true, default: 0 },
    minSubtotalCents: { type: Number, required: true, default: 0 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    usageLimit: { type: Number },
    usedCount: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

export type DiscountDocument = InferSchemaType<typeof discountSchema>;

export const Discount: Model<DiscountDocument> =
  (mongoose.models.Discount as Model<DiscountDocument>) || mongoose.model("Discount", discountSchema);
