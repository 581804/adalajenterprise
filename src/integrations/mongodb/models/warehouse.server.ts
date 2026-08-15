// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const warehouseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Ahmedabad Warehouse", "Rajkot Depot"
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    pincode: { type: String, required: true, trim: true },
    // Derived from `pincode` via PincodeOffice at save time — NEVER set
    // this directly from a form field. This is the actual value the
    // CGST/SGST vs IGST determination compares against the customer's
    // billing state, so it must come from the same authoritative source
    // (India Post data) as every other pincode-derived value in this app,
    // not a hand-typed string that could mismatch in casing or spelling.
    state: { type: String, required: true, trim: true, uppercase: true, index: true },
    // GSTIN can genuinely differ per warehouse for a business registered
    // in multiple states (a real, common GST requirement — you need a
    // separate GST registration per state you have a place of business
    // in). Optional because a single-state business may only need the
    // one GSTIN already on SiteSettings.
    gstin: { type: String, trim: true, uppercase: true },
    isActive: { type: Boolean, required: true, default: true, index: true },
    // Lower number = higher priority when automatically choosing which
    // warehouse fulfills an order line item (see order.functions.ts).
    priority: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export type WarehouseDocument = InferSchemaType<typeof warehouseSchema>;

export const Warehouse: Model<WarehouseDocument> =
  (mongoose.models.Warehouse as Model<WarehouseDocument>) || mongoose.model("Warehouse", warehouseSchema);
