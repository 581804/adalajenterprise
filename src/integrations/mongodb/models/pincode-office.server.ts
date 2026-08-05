// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const OFFICE_TYPES = ["BO", "SO", "HO", "PO"] as const; // Branch/Sub/Head/Post Office
export const DELIVERY_STATUSES = ["Delivery", "Non Delivery"] as const;

const pincodeOfficeSchema = new Schema(
  {
    pincode: { type: String, required: true, index: true, trim: true },
    officeName: { type: String, required: true, trim: true },
    officeType: { type: String, trim: true }, // BO/SO/HO/PO — not a strict enum since real data has occasional outliers
    delivery: { type: String, trim: true },
    district: { type: String, trim: true },
    stateName: { type: String, trim: true, index: true },
    circleName: { type: String, trim: true },
    regionName: { type: String, trim: true },
    divisionName: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { timestamps: true },
);

// The whole point of this collection is "given a pincode, list its
// offices" — this is the only query pattern that matters at request time,
// so it gets the only index that matters.
pincodeOfficeSchema.index({ pincode: 1, officeName: 1 }, { unique: true });

export type PincodeOfficeDocument = InferSchemaType<typeof pincodeOfficeSchema>;

export const PincodeOffice: Model<PincodeOfficeDocument> =
  (mongoose.models.PincodeOffice as Model<PincodeOfficeDocument>) ||
  mongoose.model("PincodeOffice", pincodeOfficeSchema);
