import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth-middleware";

function serializeAddress(a: any) {
  return {
    id: a._id.toString(),
    user_id: a.userId.toString(),
    label: a.label ?? null,
    full_name: a.fullName,
    line1: a.line1,
    line2: a.line2 ?? null,
    city: a.city,
    region: a.region ?? null,
    postal_code: a.postalCode,
    country: a.country,
    phone: a.phone ?? null,
    is_default: a.isDefault,
    created_at: a.createdAt,
  };
}

export const listMyAddresses = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { connectMongo } = await import("./client.server");
    const { Address } = await import("./models/address.server");
    await connectMongo();
    const addresses = await Address.find({ userId: context.userId }).sort({ isDefault: -1, createdAt: -1 }).lean();
    return addresses.map(serializeAddress);
  });

const addressInput = z.object({
  label: z.string().optional().nullable(),
  full_name: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  region: z.string().optional().nullable(),
  postal_code: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional().nullable(),
  is_default: z.boolean().optional(),
});

export const createMyAddress = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(addressInput)
  .handler(async ({ data, context }) => {
    const { connectMongo } = await import("./client.server");
    const { Address } = await import("./models/address.server");
    await connectMongo();

    if (data.is_default) {
      await Address.updateMany({ userId: context.userId }, { $set: { isDefault: false } });
    }
    const created = await Address.create({
      userId: context.userId,
      label: data.label ?? undefined,
      fullName: data.full_name,
      line1: data.line1,
      line2: data.line2 ?? undefined,
      city: data.city,
      region: data.region ?? undefined,
      postalCode: data.postal_code,
      country: data.country,
      phone: data.phone ?? undefined,
      isDefault: data.is_default ?? false,
    });
    return serializeAddress(created);
  });

export const updateMyAddress = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(addressInput.extend({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { connectMongo } = await import("./client.server");
    const { Address } = await import("./models/address.server");
    await connectMongo();

    // Ownership check: findOneAndUpdate filtered on userId, not just _id, so
    // one user can never edit another's address by guessing an id.
    if (data.is_default) {
      await Address.updateMany({ userId: context.userId }, { $set: { isDefault: false } });
    }
    const { id, ...rest } = data;
    const updated = await Address.findOneAndUpdate(
      { _id: id, userId: context.userId },
      {
        label: rest.label ?? undefined,
        fullName: rest.full_name,
        line1: rest.line1,
        line2: rest.line2 ?? undefined,
        city: rest.city,
        region: rest.region ?? undefined,
        postalCode: rest.postal_code,
        country: rest.country,
        phone: rest.phone ?? undefined,
        isDefault: rest.is_default ?? false,
      },
      { new: true },
    );
    if (!updated) throw new Error("Address not found");
    return serializeAddress(updated);
  });

export const deleteMyAddress = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { connectMongo } = await import("./client.server");
    const { Address } = await import("./models/address.server");
    await connectMongo();
    await Address.findOneAndDelete({ _id: data.id, userId: context.userId });
    return { success: true };
  });
