// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Embedded — rates always belong to, and are fetched with, their zone (was
// shipping_rates, a separate table keyed on zone_id).
const shippingRateSchema = new Schema(
  {
    name: { type: String, required: true },
    priceCents: { type: Number, required: true, default: 0 },
    minOrderCents: { type: Number, required: true, default: 0 },
    freeOverCents: { type: Number },
    estimatedDays: { type: String },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

const shippingZoneSchema = new Schema(
  {
    name: { type: String, required: true },
    countries: { type: [String], default: [] },
    isActive: { type: Boolean, required: true, default: true, index: true },
    rates: { type: [shippingRateSchema], default: [] },
  },
  { timestamps: true },
);

export type ShippingZoneDocument = InferSchemaType<typeof shippingZoneSchema>;

export const ShippingZone: Model<ShippingZoneDocument> =
  (mongoose.models.ShippingZone as Model<ShippingZoneDocument>) ||
  mongoose.model("ShippingZone", shippingZoneSchema);
