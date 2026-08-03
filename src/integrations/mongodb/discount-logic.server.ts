// Server-only. Reimplements public.redeem_discount / public.preview_discount
// from the original migrations. MongoDB has no stored-procedure equivalent,
// so this logic — previously living in the database — now lives here.
import { Discount, type DiscountDocument } from "./models/discount.server";

export type DiscountPreview = {
  id: string;
  code: string;
  type: DiscountDocument["type"];
  value: number;
  discountCents: number;
};

class DiscountError extends Error {}

function computeDiscountAmount(discount: DiscountDocument, subtotalCents: number): number {
  if (discount.type === "percent") {
    return Math.floor(subtotalCents * (discount.value / 100));
  }
  if (discount.type === "fixed") {
    return Math.min(subtotalCents, Math.trunc(discount.value));
  }
  return 0; // free_shipping: amount is 0 here, handled by the caller against shipping cost
}

/**
 * Shared validation for both preview and redeem — mirrors the identical
 * validation block duplicated across both SQL functions.
 */
function validateDiscount(discount: (DiscountDocument & { _id: unknown }) | null, subtotalCents: number): asserts discount is DiscountDocument & { _id: unknown } {
  if (!discount) throw new DiscountError("Invalid discount code");
  if (!discount.isActive) throw new DiscountError("Discount is not active");
  if (discount.startsAt && new Date() < discount.startsAt) throw new DiscountError("Discount not started yet");
  if (discount.endsAt && new Date() > discount.endsAt) throw new DiscountError("Discount expired");
  if (subtotalCents < (discount.minSubtotalCents ?? 0)) throw new DiscountError("Order does not meet minimum");
  if (discount.usageLimit != null && discount.usedCount >= discount.usageLimit) {
    throw new DiscountError("Discount usage limit reached");
  }
}

/**
 * Read-only preview — does not increment usedCount. Callable by anyone
 * (anon or authenticated), matching the original GRANT.
 */
export async function previewDiscount(code: string, subtotalCents: number): Promise<DiscountPreview> {
  const discount = await Discount.findOne({ code: code.toUpperCase() });
  validateDiscount(discount, subtotalCents);

  return {
    id: discount._id.toString(),
    code: discount.code,
    type: discount.type,
    value: discount.value,
    discountCents: computeDiscountAmount(discount, subtotalCents),
  };
}

/**
 * Redeeming actually consumes one use. Requires authentication in the
 * original (RAISE EXCEPTION 'Not authenticated' if auth.uid() IS NULL) —
 * enforce that at the call site via requireAuth middleware, same as the
 * original REVOKE EXECUTE ... FROM PUBLIC, anon / GRANT ... TO authenticated.
 *
 * Uses findOneAndUpdate with the usage-limit check repeated in the filter
 * (not just the earlier validateDiscount call) so two concurrent redemptions
 * of the last remaining use can't both succeed — the original's UPDATE ran
 * inside a single transaction implicitly; this is the Mongo equivalent of
 * that atomicity for the one write that actually matters (the increment).
 */
export async function redeemDiscount(code: string, subtotalCents: number): Promise<DiscountPreview> {
  const discount = await Discount.findOne({ code: code.toUpperCase() });
  validateDiscount(discount, subtotalCents);

  const discountCents = computeDiscountAmount(discount, subtotalCents);

  const updated = await Discount.findOneAndUpdate(
    {
      _id: discount._id,
      $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
    },
    { $inc: { usedCount: 1 } },
    { new: true },
  );

  if (!updated) {
    // Someone else consumed the last use between our read and this write.
    throw new DiscountError("Discount usage limit reached");
  }

  return { id: updated._id.toString(), code: updated.code, type: updated.type, value: updated.value, discountCents };
}
