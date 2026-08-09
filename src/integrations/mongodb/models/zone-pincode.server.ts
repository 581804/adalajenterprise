// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const zonePincodeSchema = new Schema(
  {
    pincode: { type: String, required: true, unique: true, trim: true, index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: "ShippingZone", required: true, index: true },
  },
  { timestamps: true },
);

export type ZonePincodeDocument = InferSchemaType<typeof zonePincodeSchema>;

export const ZonePincode: Model<ZonePincodeDocument> =
  (mongoose.models.ZonePincode as Model<ZonePincodeDocument>) ||
  mongoose.model("ZonePincode", zonePincodeSchema);
