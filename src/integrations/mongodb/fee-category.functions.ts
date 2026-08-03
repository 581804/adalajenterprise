import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";

function serializeFeeCategory(f: any) {
  return {
    id: f._id.toString(),
    name: f.name,
    description: f.description ?? null,
    amount_cents: f.amountCents,
    percent: f.percent,
    scope: f.scope,
    taxable: f.taxable,
    tax_rate_id: f.taxRateId ? f.taxRateId.toString() : null,
    is_active: f.isActive,
  };
}

export const adminListFeeCategories = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { FeeCategory } = await import("./models/fee-category.server");
    await connectMongo();
    const fees = await FeeCategory.find().sort({ name: 1 }).lean();
    return fees.map(serializeFeeCategory);
  });

const feeCategoryInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  amount_cents: z.number().min(0).optional(),
  percent: z.number().min(0).optional(),
  scope: z.enum(["per_unit", "per_order"]).optional(),
  taxable: z.boolean().optional(),
  tax_rate_id: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const adminCreateFeeCategory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(feeCategoryInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { FeeCategory } = await import("./models/fee-category.server");
    await connectMongo();
    const created = await FeeCategory.create({
      name: data.name,
      description: data.description ?? undefined,
      amountCents: data.amount_cents ?? 0,
      percent: data.percent ?? 0,
      scope: data.scope ?? "per_unit",
      taxable: data.taxable ?? false,
      taxRateId: data.tax_rate_id || null,
      isActive: data.is_active ?? true,
    });
    return serializeFeeCategory(created);
  });

export const adminUpdateFeeCategory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(feeCategoryInput.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { FeeCategory } = await import("./models/fee-category.server");
    await connectMongo();
    const { id, ...rest } = data;
    const updated = await FeeCategory.findByIdAndUpdate(
      id,
      {
        name: rest.name,
        description: rest.description ?? undefined,
        amountCents: rest.amount_cents ?? 0,
        percent: rest.percent ?? 0,
        scope: rest.scope ?? "per_unit",
        taxable: rest.taxable ?? false,
        taxRateId: rest.tax_rate_id || null,
        isActive: rest.is_active ?? true,
      },
      { new: true },
    );
    if (!updated) throw new Error("Fee category not found");
    return serializeFeeCategory(updated);
  });

export const adminDeleteFeeCategory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { FeeCategory } = await import("./models/fee-category.server");
    await connectMongo();
    await FeeCategory.findByIdAndDelete(data.id);
    return { success: true };
  });
