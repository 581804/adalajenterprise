import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";

function serializeStock(s: any) {
  return {
    id: s._id.toString(),
    warehouse_id: s.warehouseId.toString(),
    product_id: s.productId.toString(),
    variant_id: s.variantId ? s.variantId.toString() : null,
    quantity: s.quantity,
  };
}

/** Every warehouse's stock level for one product (all variants included). */
export const adminGetProductWarehouseStock = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ productId: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { WarehouseStock } = await import("./models/warehouse-stock.server");
    await connectMongo();
    const rows = await WarehouseStock.find({ productId: data.productId }).lean();
    return rows.map(serializeStock);
  });

/**
 * Sets (not adjusts) the stock quantity for one (warehouse, product,
 * variant) combination — upserts, since a product may not have a stock
 * row for every warehouse yet (defaults to 0 until explicitly set).
 */
export const adminSetWarehouseStock = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({
      warehouseId: z.string(),
      productId: z.string(),
      variantId: z.string().optional().nullable(),
      quantity: z.number().min(0),
    }),
  )
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { WarehouseStock } = await import("./models/warehouse-stock.server");
    await connectMongo();
    const updated = await WarehouseStock.findOneAndUpdate(
      { warehouseId: data.warehouseId, productId: data.productId, variantId: data.variantId || null },
      { $set: { quantity: data.quantity } },
      { upsert: true, new: true },
    );
    return serializeStock(updated);
  });
