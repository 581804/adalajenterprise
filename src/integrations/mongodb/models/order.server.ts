// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { randomBytes } from "node:crypto";
import { DEFAULT_CURRENCY } from "@/lib/format";

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "fulfilled",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Embedded and intentionally NOT referencing live Product data at read time
// — title/unitPriceCents/variantName/imageUrl are a frozen snapshot of what
// the customer actually bought, exactly like the original order_items table.
// Never re-derive these from the current Product document.
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" }, // nullable: ON DELETE SET NULL in the original
    variantId: { type: Schema.Types.ObjectId },
    title: { type: String, required: true },
    variantName: { type: String },
    unitPriceCents: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String },
    // Per-line snapshot of tax/fee attributable to this item, for an
    // itemized Amazon/Flipkart-style breakdown. Optional (not `required`)
    // because orders created before this field existed won't have it —
    // the UI shows the aggregate-only view for those, full per-line detail
    // for orders going forward. Never recomputed after the fact; frozen at
    // purchase time exactly like unitPriceCents/title above.
    lineSubtotalCents: { type: Number },
    taxRateName: { type: String },
    taxRatePercent: { type: Number },
    taxCents: { type: Number },
    feeName: { type: String },
    feeCents: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

function generateOrderNumber(): string {
  // Mirrors 'ORD-' || upper(substr(md5(random()::text), 1, 8)) from the
  // original DEFAULT expression — 8 uppercase hex chars.
  return `ORD-${randomBytes(4).toString("hex").toUpperCase()}`;
}

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, default: generateOrderNumber },
    // Original schema went through user_id nullable -> NOT NULL (see the
    // later migration enforcing this to prevent unreachable guest orders).
    // Keep it required here to match the final, corrected constraint.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: "pending", index: true },
    subtotalCents: { type: Number, required: true, default: 0 },
    shippingCents: { type: Number, required: true, default: 0 },
    taxCents: { type: Number, required: true, default: 0 },
    discountCents: { type: Number, required: true, default: 0 },
    feeCents: { type: Number, required: true, default: 0 },
    totalCents: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: DEFAULT_CURRENCY },
    shippingAddress: { type: Schema.Types.Mixed, default: {} },
    billingAddress: { type: Schema.Types.Mixed, default: {} },
    discountCode: { type: String },
    shippingMethod: { type: String },
    notes: { type: String },
    trackingNumber: { type: String },
    carrier: { type: String },
    trackingUrl: { type: String },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    adminNote: { type: String },
    items: { type: [orderItemSchema], default: [] },
  },
  { timestamps: true },
);

export type OrderDocument = InferSchemaType<typeof orderSchema>;

export const Order: Model<OrderDocument> =
  (mongoose.models.Order as Model<OrderDocument>) || mongoose.model("Order", orderSchema);
