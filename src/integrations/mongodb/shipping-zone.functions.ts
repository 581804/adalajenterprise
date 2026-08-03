import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";

function serializeRate(r: any) {
  return {
    id: r._id.toString(),
    name: r.name,
    price_cents: r.priceCents,
    min_order_cents: r.minOrderCents,
    free_over_cents: r.freeOverCents ?? null,
    estimated_days: r.estimatedDays ?? null,
    is_active: r.isActive,
  };
}

function serializeZone(z: any) {
  return {
    id: z._id.toString(),
    name: z.name,
    countries: z.countries ?? [],
    is_active: z.isActive,
    shipping_rates: (z.rates ?? []).map(serializeRate),
  };
}

/**
 * Public: active shipping rates available for a given country, for the
 * checkout page's shipping-method selector. Matches the original
 * `.select("*, shipping_rates(*)").eq("is_active", true).contains("countries", [country])`.
 */
export const listActiveShippingForCountry = createServerFn({ method: "GET" })
  .validator(z.object({ country: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ShippingZone } = await import("./models/shipping-zone.server");
    await connectMongo();
    const zones = await ShippingZone.find({ isActive: true, countries: data.country }).lean();
    return zones.map((z) => ({
      ...serializeZone(z),
      shipping_rates: (z.rates ?? []).filter((r: any) => r.isActive).map(serializeRate),
    }));
  });

export const adminListShippingZones = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { ShippingZone } = await import("./models/shipping-zone.server");
    await connectMongo();
    const zones = await ShippingZone.find().sort({ name: 1 }).lean();
    return zones.map(serializeZone);
  });

const rateInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  price_cents: z.number().min(0),
  min_order_cents: z.number().min(0).optional(),
  free_over_cents: z.number().optional().nullable(),
  estimated_days: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

const zoneInput = z.object({
  name: z.string().min(1),
  countries: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  rates: z.array(rateInput).optional(),
});

function toZoneDoc(data: z.infer<typeof zoneInput>) {
  return {
    name: data.name,
    countries: data.countries ?? [],
    isActive: data.is_active ?? true,
    rates: (data.rates ?? []).map((r) => ({
      _id: r.id,
      name: r.name,
      priceCents: r.price_cents,
      minOrderCents: r.min_order_cents ?? 0,
      freeOverCents: r.free_over_cents ?? undefined,
      estimatedDays: r.estimated_days ?? undefined,
      isActive: r.is_active ?? true,
    })),
  };
}

export const adminCreateShippingZone = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(zoneInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ShippingZone } = await import("./models/shipping-zone.server");
    await connectMongo();
    const created = await ShippingZone.create(toZoneDoc(data));
    return serializeZone(created);
  });

export const adminUpdateShippingZone = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(zoneInput.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ShippingZone } = await import("./models/shipping-zone.server");
    await connectMongo();
    const { id, ...rest } = data;
    const updated = await ShippingZone.findByIdAndUpdate(id, toZoneDoc(rest), { new: true });
    if (!updated) throw new Error("Shipping zone not found");
    return serializeZone(updated);
  });

export const adminDeleteShippingZone = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ShippingZone } = await import("./models/shipping-zone.server");
    await connectMongo();
    await ShippingZone.findByIdAndDelete(data.id);
    return { success: true };
  });
