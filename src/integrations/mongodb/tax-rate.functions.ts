import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";

function serializeTaxRate(t: any) {
  return {
    id: t._id.toString(),
    name: t.name,
    country: t.country,
    region: t.region ?? null,
    rate_percent: t.ratePercent,
    is_active: t.isActive,
  };
}

export const listActiveTaxRates = createServerFn({ method: "GET" }).handler(async () => {
  const { connectMongo } = await import("./client.server");
  const { TaxRate } = await import("./models/tax-rate.server");
  await connectMongo();
  const rates = await TaxRate.find({ isActive: true }).lean();
  return rates.map(serializeTaxRate);
});

export const adminListTaxRates = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { TaxRate } = await import("./models/tax-rate.server");
    await connectMongo();
    const rates = await TaxRate.find().sort({ name: 1 }).lean();
    return rates.map(serializeTaxRate);
  });

const taxRateInput = z.object({
  name: z.string().min(1),
  country: z.string().min(1),
  region: z.string().optional().nullable(),
  rate_percent: z.number().min(0),
  is_active: z.boolean().optional(),
});

export const adminCreateTaxRate = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(taxRateInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { TaxRate } = await import("./models/tax-rate.server");
    await connectMongo();
    const created = await TaxRate.create({
      name: data.name,
      country: data.country,
      region: data.region ?? undefined,
      ratePercent: data.rate_percent,
      isActive: data.is_active ?? true,
    });
    return serializeTaxRate(created);
  });

export const adminUpdateTaxRate = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(taxRateInput.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { TaxRate } = await import("./models/tax-rate.server");
    await connectMongo();
    const { id, ...rest } = data;
    const updated = await TaxRate.findByIdAndUpdate(
      id,
      { name: rest.name, country: rest.country, region: rest.region ?? undefined, ratePercent: rest.rate_percent, isActive: rest.is_active ?? true },
      { new: true },
    );
    if (!updated) throw new Error("Tax rate not found");
    return serializeTaxRate(updated);
  });

export const adminDeleteTaxRate = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { TaxRate } = await import("./models/tax-rate.server");
    await connectMongo();
    await TaxRate.findByIdAndDelete(data.id);
    return { success: true };
  });
