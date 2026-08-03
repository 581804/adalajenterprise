import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";

function serializeDiscount(d: any) {
  return {
    id: d._id.toString(),
    code: d.code,
    description: d.description ?? null,
    type: d.type,
    value: d.value,
    min_subtotal_cents: d.minSubtotalCents,
    starts_at: d.startsAt ?? null,
    ends_at: d.endsAt ?? null,
    usage_limit: d.usageLimit ?? null,
    used_count: d.usedCount,
    is_active: d.isActive,
    created_at: d.createdAt,
  };
}

export const adminListDiscounts = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { Discount } = await import("./models/discount.server");
    await connectMongo();
    const discounts = await Discount.find().sort({ createdAt: -1 }).lean();
    return discounts.map(serializeDiscount);
  });

const discountInput = z.object({
  code: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.enum(["percent", "fixed", "free_shipping"]),
  value: z.number(),
  min_subtotal_cents: z.number().optional(),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
  usage_limit: z.number().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const adminCreateDiscount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(discountInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Discount } = await import("./models/discount.server");
    await connectMongo();
    const created = await Discount.create({
      code: data.code,
      description: data.description ?? undefined,
      type: data.type,
      value: data.value,
      minSubtotalCents: data.min_subtotal_cents ?? 0,
      startsAt: data.starts_at ? new Date(data.starts_at) : undefined,
      endsAt: data.ends_at ? new Date(data.ends_at) : undefined,
      usageLimit: data.usage_limit ?? undefined,
      isActive: data.is_active ?? true,
    });
    return serializeDiscount(created);
  });

export const adminUpdateDiscount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(discountInput.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Discount } = await import("./models/discount.server");
    await connectMongo();
    const { id, ...rest } = data;
    const updated = await Discount.findByIdAndUpdate(
      id,
      {
        code: rest.code,
        description: rest.description ?? undefined,
        type: rest.type,
        value: rest.value,
        minSubtotalCents: rest.min_subtotal_cents ?? 0,
        startsAt: rest.starts_at ? new Date(rest.starts_at) : null,
        endsAt: rest.ends_at ? new Date(rest.ends_at) : null,
        usageLimit: rest.usage_limit ?? null,
        isActive: rest.is_active ?? true,
      },
      { new: true },
    );
    if (!updated) throw new Error("Discount not found");
    return serializeDiscount(updated);
  });

export const adminDeleteDiscount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Discount } = await import("./models/discount.server");
    await connectMongo();
    await Discount.findByIdAndDelete(data.id);
    return { success: true };
  });
