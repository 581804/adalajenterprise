import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";

function serializeOffice(o: any) {
  return {
    id: o._id.toString(),
    pincode: o.pincode,
    office_name: o.officeName,
    office_type: o.officeType ?? null,
    delivery: o.delivery ?? null,
    district: o.district ?? null,
    state_name: o.stateName ?? null,
    circle_name: o.circleName ?? null,
    region_name: o.regionName ?? null,
    division_name: o.divisionName ?? null,
  };
}

/**
 * Public: every office registered for a pincode. The address form calls
 * this on pincode entry — if it returns more than one result, the form
 * must present a selector (office name -> auto-fills district/state) rather
 * than silently picking one. ~89% of real pincodes return more than one
 * office, so this is the common path, not an edge case.
 */
export const lookupPincode = createServerFn({ method: "GET" })
  .validator(z.object({ pincode: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { PincodeOffice } = await import("./models/pincode-office.server");
    await connectMongo();
    const offices = await PincodeOffice.find({ pincode: data.pincode.trim() }).sort({ officeName: 1 }).lean();
    return offices.map(serializeOffice);
  });

// --- Admin import/export ---
// Deliberately chunked rather than "upload the whole CSV in one request":
// this dataset is ~22MB / 165k+ rows, well past what a single Vercel
// serverless invocation should be trusted to process synchronously (default
// execution limits and request body size vary by plan, and a large payload
// risks hitting either). The client parses the CSV locally and streams rows
// in batches; the server just does a bulk upsert per batch call.

const importRowSchema = z.object({
  pincode: z.string(),
  officename: z.string(),
  officetype: z.string().optional(),
  delivery: z.string().optional(),
  district: z.string().optional(),
  statename: z.string().optional(),
  circlename: z.string().optional(),
  regionname: z.string().optional(),
  divisionname: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

export const adminImportPincodeBatch = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ rows: z.array(importRowSchema).max(5000) }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { PincodeOffice } = await import("./models/pincode-office.server");
    await connectMongo();

    const parseNum = (v?: string) => {
      if (!v || v === "NA" || v.trim() === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    // Upsert on (pincode, officeName) — matches the unique index, so
    // re-running an import (e.g. India Post's periodic data refresh) is
    // safe: existing offices get updated in place rather than duplicated.
    const ops = data.rows.map((r) => ({
      updateOne: {
        filter: { pincode: r.pincode.trim(), officeName: r.officename.trim() },
        update: {
          $set: {
            pincode: r.pincode.trim(),
            officeName: r.officename.trim(),
            officeType: r.officetype?.trim() || undefined,
            delivery: r.delivery?.trim() || undefined,
            district: r.district?.trim() || undefined,
            stateName: r.statename?.trim() || undefined,
            circleName: r.circlename?.trim() || undefined,
            regionName: r.regionname?.trim() || undefined,
            divisionName: r.divisionname?.trim() || undefined,
            latitude: parseNum(r.latitude),
            longitude: parseNum(r.longitude),
          },
        },
        upsert: true,
      },
    }));

    const result = await PincodeOffice.bulkWrite(ops, { ordered: false });
    return {
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
      matched: result.matchedCount,
    };
  });

export const adminPincodeStats = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { PincodeOffice } = await import("./models/pincode-office.server");
    await connectMongo();
    const totalOffices = await PincodeOffice.estimatedDocumentCount();
    const distinctPincodes = (await PincodeOffice.distinct("pincode")).length;
    return { totalOffices, distinctPincodes };
  });

export const adminDeleteAllPincodes = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { PincodeOffice } = await import("./models/pincode-office.server");
    await connectMongo();
    const result = await PincodeOffice.deleteMany({});
    return { deleted: result.deletedCount };
  });

/**
 * Export — paginated for the same reason import is chunked: returning
 * 165k+ rows in one server-function response risks the same size/timeout
 * limits. The client calls this repeatedly with an increasing `skip` and
 * assembles the full CSV locally before triggering the download.
 */
export const adminExportPincodePage = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ skip: z.number().min(0), limit: z.number().min(1).max(5000) }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { PincodeOffice } = await import("./models/pincode-office.server");
    await connectMongo();
    const rows = await PincodeOffice.find().sort({ _id: 1 }).skip(data.skip).limit(data.limit).lean();
    return rows.map((r) => ({
      circlename: r.circleName ?? "",
      regionname: r.regionName ?? "",
      divisionname: r.divisionName ?? "",
      officename: r.officeName,
      pincode: r.pincode,
      officetype: r.officeType ?? "",
      delivery: r.delivery ?? "",
      district: r.district ?? "",
      statename: r.stateName ?? "",
      latitude: r.latitude?.toString() ?? "NA",
      longitude: r.longitude?.toString() ?? "NA",
    }));
  });
