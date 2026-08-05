// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const countryCodeSchema = new Schema(
  {
    iso2: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. "IN"
    name: { type: String, required: true, trim: true }, // e.g. "India"
    callingCode: { type: String, required: true, trim: true }, // e.g. "91" (no leading +)
  },
  { timestamps: true },
);

export type CountryCodeDocument = InferSchemaType<typeof countryCodeSchema>;

export const CountryCode: Model<CountryCodeDocument> =
  (mongoose.models.CountryCode as Model<CountryCodeDocument>) ||
  mongoose.model("CountryCode", countryCodeSchema);
