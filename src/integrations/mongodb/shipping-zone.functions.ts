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

/**
 * Primary checkout lookup: given the customer's pincode, find the zone it's
 * assigned to and return that zone's active rates. Falls back to
 * country-based matching (the original mechanism) if the pincode hasn't
 * been assigned to any zone yet — so shipping doesn't just silently break
 * for a pincode you haven't gotten around to importing, it falls back to
 * whatever country-level zones exist (if any).
 */
export const listActiveShippingForPincode = createServerFn({ method: "GET" })
  .validator(z.object({ pincode: z.string(), country: z.string().optional() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ShippingZone } = await import("./models/shipping-zone.server");
    const { ZonePincode } = await import("./models/zone-pincode.server");
    await connectMongo();

    const assignment = await ZonePincode.findOne({ pincode: data.pincode.trim() }).lean();
    if (assignment) {
      const zone = await ShippingZone.findOne({ _id: assignment.zoneId, isActive: true }).lean();
      if (zone) {
        return [
          {
            ...serializeZone(zone),
            shipping_rates: (zone.rates ?? []).filter((r: any) => r.isActive).map(serializeRate),
          },
        ];
      }
      // Assigned to a zone that's since been deactivated/deleted — fall
      // through to the country fallback rather than returning nothing.
    }

    if (!data.country) return [];
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

// --- Zone pincode assignment ---
// Same chunked-import approach already proven for the India Post office
// dataset: a zone could realistically hold thousands of pincodes, so
// import/export are batched rather than a single request.

const PINCODE_RE = /^\d{6}$/;

export const adminZonePincodeStats = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ zoneId: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ZonePincode } = await import("./models/zone-pincode.server");
    await connectMongo();
    const count = await ZonePincode.countDocuments({ zoneId: data.zoneId });
    return { count };
  });

/**
 * Import a batch of pincodes into a zone. Upserts by pincode (the unique
 * key) — a pincode already assigned to a different zone is REASSIGNED to
 * this one, not duplicated or rejected. Invalid-format entries (not a
 * 6-digit number) are skipped and reported rather than silently inserted.
 */
export const adminImportZonePincodeBatch = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ zoneId: z.string(), pincodes: z.array(z.string()).max(5000) }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ZonePincode } = await import("./models/zone-pincode.server");
    await connectMongo();

    const valid: string[] = [];
    let invalidCount = 0;
    for (const raw of data.pincodes) {
      const pin = raw.trim();
      if (PINCODE_RE.test(pin)) valid.push(pin);
      else if (pin) invalidCount++; // ignore genuinely blank lines silently, report malformed ones
    }

    if (valid.length === 0) return { assigned: 0, invalid: invalidCount };

    const ops = valid.map((pin) => ({
      updateOne: {
        filter: { pincode: pin },
        update: { $set: { pincode: pin, zoneId: data.zoneId as any } },
        upsert: true,
      },
    }));
    const result = await ZonePincode.bulkWrite(ops, { ordered: false });
    return { assigned: result.upsertedCount + result.modifiedCount + result.matchedCount, invalid: invalidCount };
  });

export const adminSearchZonePincodes = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ zoneId: z.string(), query: z.string().optional(), skip: z.number().min(0).optional(), limit: z.number().min(1).max(200).optional() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ZonePincode } = await import("./models/zone-pincode.server");
    await connectMongo();
    const filter: Record<string, unknown> = { zoneId: data.zoneId };
    if (data.query?.trim()) filter.pincode = { $regex: `^${data.query.trim()}` };
    const rows = await ZonePincode.find(filter)
      .sort({ pincode: 1 })
      .skip(data.skip ?? 0)
      .limit(data.limit ?? 50)
      .lean();
    return rows.map((r) => r.pincode);
  });

export const adminRemoveZonePincode = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ pincode: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ZonePincode } = await import("./models/zone-pincode.server");
    await connectMongo();
    await ZonePincode.deleteOne({ pincode: data.pincode });
    return { success: true };
  });

export const adminClearZonePincodes = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ zoneId: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ZonePincode } = await import("./models/zone-pincode.server");
    await connectMongo();
    const result = await ZonePincode.deleteMany({ zoneId: data.zoneId });
    return { deleted: result.deletedCount };
  });

/** Paginated export, same reasoning as the pincode-office export: a large
 * zone's list shouldn't be returned in one oversized response. */
export const adminExportZonePincodesPage = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ zoneId: z.string(), skip: z.number().min(0), limit: z.number().min(1).max(5000) }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { ZonePincode } = await import("./models/zone-pincode.server");
    await connectMongo();
    const rows = await ZonePincode.find({ zoneId: data.zoneId })
      .sort({ pincode: 1 })
      .skip(data.skip)
      .limit(data.limit)
      .lean();
    return rows.map((r) => r.pincode);
  });
