// Server-only, but deliberately pure (no DB calls) so this can be unit
// tested in isolation — this is the actual compliance-critical logic in
// the whole GST feature, and it must be verifiably correct on its own
// before it's trusted inside order creation or invoice generation.
//
// GST BASICS THIS IMPLEMENTS (standard Indian GST law, not this app's own
// invention — have a CA confirm this matches your actual registration
// before relying on it for real filing):
// - GST is destination-based: whether a transaction is "intrastate" or
//   "interstate" depends on the supplier's state (the warehouse fulfilling
//   the order) vs the place of supply (the customer's billing state) —
//   NOT the shipping address, and NOT some single fixed "company state".
//   With multiple warehouses, this can differ order to order, and even
//   line-item to line-item if different items ship from different
//   warehouses.
// - INTRASTATE (same state): CGST + SGST, each exactly half of the
//   product's configured GST rate. A rate of 18% becomes CGST 9% + SGST 9%.
// - INTERSTATE (different states): IGST at the FULL configured rate. The
//   same 18% product charges IGST 18%, not 9%+9%.
// - Critically: the TOTAL tax the customer pays is the same either way
//   (9+9=18, or 18). This is not an extra charge layered on for
//   interstate orders — it's the same total tax, reported differently for
//   center/state revenue-sharing purposes. Getting this wrong doesn't
//   necessarily overcharge the customer, but it DOES misreport tax to the
//   wrong authority, which is the actual compliance risk.

export type GstBreakdown =
  | { type: "intrastate"; cgstPercent: number; sgstPercent: number; igstPercent: number; cgstCents: number; sgstCents: number; igstCents: number }
  | { type: "interstate"; cgstPercent: number; sgstPercent: number; igstPercent: number; cgstCents: number; sgstCents: number; igstCents: number }
  | { type: "unknown"; cgstPercent: number; sgstPercent: number; igstPercent: number; cgstCents: number; sgstCents: number; igstCents: number };

/**
 * Determines CGST+SGST vs IGST split for one taxable amount, given the
 * supplying warehouse's state and the customer's billing state.
 *
 * @param amountCents - either a pre-tax taxable BASE (rate gets applied),
 *   or an already-computed total tax amount to just split — see options.amountIsAlreadyTax
 * @param gstRatePercent - the TOTAL configured GST rate (e.g. 18 for 18%),
 *   matching TaxRate.ratePercent — this is the combined rate, not a
 *   pre-split CGST/SGST number. The split happens here, not in admin config,
 *   so an admin can never accidentally set CGST+SGST to something that
 *   doesn't sum to the IGST rate for the same goods (a real compliance bug
 *   if it happened).
 * @param sellerState - the warehouse's state (already normalized uppercase
 *   via the Warehouse model)
 * @param buyerState - the customer's billing address state
 */
export function determineGstSplit(
  amountCents: number,
  gstRatePercent: number,
  sellerState: string | null | undefined,
  buyerState: string | null | undefined,
  options: { amountIsAlreadyTax?: boolean } = {},
): GstBreakdown {
  const normalizedSeller = sellerState?.trim().toUpperCase() || null;
  const normalizedBuyer = buyerState?.trim().toUpperCase() || null;

  // If either state is missing, we genuinely cannot determine intra vs
  // interstate — this should never silently guess. Returns zero tax with
  // type "unknown" so the caller can surface this as an error requiring
  // manual resolution, rather than charging a possibly-wrong tax type.
  if (!normalizedSeller || !normalizedBuyer) {
    return { type: "unknown", cgstPercent: 0, sgstPercent: 0, igstPercent: 0, cgstCents: 0, sgstCents: 0, igstCents: 0 };
  }

  const isIntrastate = normalizedSeller === normalizedBuyer;

  // amountIsAlreadyTax: true when the caller has already backed the tax
  // portion out of a tax-inclusive price (e.g. Rs 100 at 18% inclusive ->
  // Rs 15.25 embedded tax) and is passing THAT number in — meaning the
  // rate must NOT be applied again, only split. Without this flag, this
  // function always assumed its input was a pre-tax BASE to multiply by
  // the rate, which silently re-applied 18% on top of an already-final
  // tax figure when first used for inclusive-tax products — confirmed as
  // a real bug via direct testing before this fix (Rs 15.25 embedded tax
  // was being treated as a base and re-taxed down to Rs 2.75).
  const totalTaxCents = options.amountIsAlreadyTax ? Math.round(amountCents) : Math.round(amountCents * (gstRatePercent / 100));

  if (isIntrastate) {
    const halfPercent = gstRatePercent / 2;
    // Split the single computed total, not two independently rounded
    // halves — see the halving logic below for why (rounding-drift note
    // retained where the split actually happens).
    const cgstCents = Math.floor(totalTaxCents / 2);
    const sgstCents = totalTaxCents - cgstCents; // absorbs the odd paisa if totalTaxCents is odd
    return { type: "intrastate", cgstPercent: halfPercent, sgstPercent: halfPercent, igstPercent: 0, cgstCents, sgstCents, igstCents: 0 };
  }

  return { type: "interstate", cgstPercent: 0, sgstPercent: 0, igstPercent: gstRatePercent, cgstCents: 0, sgstCents: 0, igstCents: totalTaxCents };
}
