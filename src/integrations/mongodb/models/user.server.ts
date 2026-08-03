// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Mirrors the old public.user_roles.role enum — extend here if more roles
// are added later (e.g. "support"). Keep in sync with any role checks in
// server-side auth middleware.
export const USER_ROLES = ["customer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    // Stable Google account identifier ("sub" claim from the verified ID
    // token). This, not email, is the true unique key for a Google-auth'd
    // user — a Google account's email can change, its sub cannot.
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },
    role: { type: String, enum: USER_ROLES, default: "customer", required: true },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;

// Prevent Mongoose's "OverwriteModelError" when this module is re-evaluated
// under HMR in dev — reuse the existing compiled model if present.
export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument>) || mongoose.model("User", userSchema);
