// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const addressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String },
    fullName: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    region: { type: String },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type AddressDocument = InferSchemaType<typeof addressSchema>;

export const Address: Model<AddressDocument> =
  (mongoose.models.Address as Model<AddressDocument>) || mongoose.model("Address", addressSchema);
