// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Embedded — cart items are always read/written together with their cart,
// never queried independently (was cart_items, a separate table).
const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId }, // references the embedded variant's _id on Product
    quantity: { type: Number, required: true, default: 1, min: 1 },
  },
  { timestamps: true },
);

const cartSchema = new Schema(
  {
    // One cart per user (was carts.user_id UNIQUE). A user's session should
    // always resolve to exactly one cart document.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

export type CartDocument = InferSchemaType<typeof cartSchema>;

export const Cart: Model<CartDocument> =
  (mongoose.models.Cart as Model<CartDocument>) || mongoose.model("Cart", cartSchema);
