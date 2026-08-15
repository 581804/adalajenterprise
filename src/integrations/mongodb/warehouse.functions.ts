import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";

function serializeWarehouse(w: any) {
  return {
    id: w._id.toString(),
    name: w.name,
    address_line1: w.addressLine1,
    address_line2: w.addressLine2 ?? null,
    city: w.city ?? null,
    pincode: w.pincode,
    state: w.state,
    gstin: w.gstin ?? null,
    is_active: w.isActive,
    priority: w.priority,
  };
}

/**
 * Looks up the state for a pincode using the same PincodeOffice dataset
 * already powering checkout address autofill — never derive a warehouse's
 * state from anything the admin typed by hand, since that value directly
 * feeds the CGST/SGST vs IGST determination and a typo there is a real
 * compliance bug, not just a display issue.
 */
async function deriveStateFromPincode(pincode: string): Promise<string> {
  const { PincodeOffice } = await import("./models/pincode-office.server");
  const office = await PincodeOffice.findOne({ pincode: pincode.trim() });
  if (!office?.stateName) {
    throw new Error(
      `Could not determine the state for pincode ${pincode} — it wasn't found in the imported pincode data. Import the India Post dataset via Admin > Pincodes first, or double-check the pincode is correct.`,
    );
  }
  return office.stateName.trim().toUpperCase();
}

export const adminListWarehouses = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { Warehouse } = await import("./models/warehouse.server");
    await connectMongo();
    const warehouses = await Warehouse.find().sort({ priority: 1, name: 1 }).lean();
    return warehouses.map(serializeWarehouse);
  });

const warehouseInput = z.object({
  name: z.string().min(1),
  address_line1: z.string().min(1),
  address_line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  pincode: z.string().min(1),
  gstin: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  priority: z.number().optional(),
});

export const adminCreateWarehouse = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(warehouseInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Warehouse } = await import("./models/warehouse.server");
    await connectMongo();
    const state = await deriveStateFromPincode(data.pincode);
    const created = await Warehouse.create({
      name: data.name,
      addressLine1: data.address_line1,
      addressLine2: data.address_line2 ?? undefined,
      city: data.city ?? undefined,
      pincode: data.pincode.trim(),
      state,
      gstin: data.gstin ?? undefined,
      isActive: data.is_active ?? true,
      priority: data.priority ?? 0,
    });
    return serializeWarehouse(created);
  });

export const adminUpdateWarehouse = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(warehouseInput.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Warehouse } = await import("./models/warehouse.server");
    await connectMongo();
    const state = await deriveStateFromPincode(data.pincode);
    const { id, ...rest } = data;
    const updated = await Warehouse.findByIdAndUpdate(
      id,
      {
        name: rest.name,
        addressLine1: rest.address_line1,
        addressLine2: rest.address_line2 ?? undefined,
        city: rest.city ?? undefined,
        pincode: rest.pincode.trim(),
        state,
        gstin: rest.gstin ?? undefined,
        isActive: rest.is_active ?? true,
        priority: rest.priority ?? 0,
      },
      { new: true },
    );
    if (!updated) throw new Error("Warehouse not found");
    return serializeWarehouse(updated);
  });

export const adminDeleteWarehouse = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Warehouse } = await import("./models/warehouse.server");
    const { WarehouseStock } = await import("./models/warehouse-stock.server");
    await connectMongo();
    // Clean up stock records for this warehouse too — an orphaned
    // WarehouseStock row pointing at a deleted warehouse would silently
    // never be selectable at checkout anyway, but leaving it around invites
    // confusion in stock reports.
    await WarehouseStock.deleteMany({ warehouseId: data.id });
    await Warehouse.findByIdAndDelete(data.id);
    return { success: true };
  });
