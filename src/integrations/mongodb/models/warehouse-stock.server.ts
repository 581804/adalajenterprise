// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const warehouseStockSchema = new Schema(
  {
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    // Null for a product with no variants; a specific variant's _id
    // otherwise. A product WITH variants tracks stock per variant per
    // warehouse, not one number for the whole product, since different
    // sizes/colors realistically sit in different quantities.
    variantId: { type: Schema.Types.ObjectId, default: null },
    quantity: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

// One stock record per (warehouse, product, variant) combination — the
// actual key this whole feature reads and writes by.
warehouseStockSchema.index({ warehouseId: 1, productId: 1, variantId: 1 }, { unique: true });

export type WarehouseStockDocument = InferSchemaType<typeof warehouseStockSchema>;

export const WarehouseStock: Model<WarehouseStockDocument> =
  (mongoose.models.WarehouseStock as Model<WarehouseStockDocument>) ||
  mongoose.model("WarehouseStock", warehouseStockSchema);
