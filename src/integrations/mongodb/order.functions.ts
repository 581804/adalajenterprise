// Server-only checkout logic.
//
// IMPORTANT DELIBERATE CHANGE FROM THE ORIGINAL APP, worth knowing about:
// The original checkout.tsx computed subtotal/tax/fees/shipping/discount
// entirely client-side, then INSERTed an order row with those client-computed
// cent amounts trusted as-is. Nothing on the server re-validated that the
// numbers were internally consistent with live product prices — a modified
// client could have POSTed arbitrary totals directly to Supabase's REST API.
// Since this is real money-handling logic being rebuilt from scratch anyway,
// this version recomputes every total SERVER-SIDE from live Product/TaxRate/
// FeeCategory/ShippingZone data and IGNORES any totals the client sends. The
// math itself (tax-inclusive vs exclusive, per-unit vs per-order fees, the
// free-shipping discount special case) is ported line-for-line from
// checkout.tsx so the displayed preview and the actually-stored order agree.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { requireAuth, requireAdmin } from "./auth-middleware";
import { ORDER_STATUSES } from "./models/order.server";
import { previewDiscount, redeemDiscount } from "./discount-logic.server";
import { DEFAULT_CURRENCY } from "@/lib/format";
import { determineGstSplit } from "@/lib/gst";
import { selectFulfillingWarehouse } from "@/lib/warehouse-fulfillment";

function serializeOrder(o: any) {
  return {
    id: o._id.toString(),
    order_number: o.orderNumber,
    user_id: o.userId.toString(),
    email: o.email,
    status: o.status,
    subtotal_cents: o.subtotalCents,
    shipping_cents: o.shippingCents,
    tax_cents: o.taxCents,
    cgst_cents: o.cgstCents ?? 0,
    sgst_cents: o.sgstCents ?? 0,
    igst_cents: o.igstCents ?? 0,
    discount_cents: o.discountCents,
    fee_cents: o.feeCents,
    total_cents: o.totalCents,
    currency: o.currency,
    shipping_address: o.shippingAddress ?? {},
    billing_address: o.billingAddress ?? {},
    discount_code: o.discountCode ?? null,
    shipping_method: o.shippingMethod ?? null,
    notes: o.notes ?? null,
    tracking_number: o.trackingNumber ?? null,
    carrier: o.carrier ?? null,
    tracking_url: o.trackingUrl ?? null,
    shipped_at: o.shippedAt ?? null,
    delivered_at: o.deliveredAt ?? null,
    admin_note: o.adminNote ?? null,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    order_items: (o.items ?? []).map((it: any) => ({
      id: it._id.toString(),
      product_id: it.productId ? it.productId.toString() : null,
      variant_id: it.variantId ? it.variantId.toString() : null,
      title: it.title,
      variant_name: it.variantName ?? null,
      unit_price_cents: it.unitPriceCents,
      quantity: it.quantity,
      image_url: it.imageUrl ?? null,
      // Present only on orders placed after this field was added — null on
      // older orders, which the UI handles by falling back to aggregate-only display.
      line_subtotal_cents: it.lineSubtotalCents ?? null,
      tax_rate_name: it.taxRateName ?? null,
      tax_rate_percent: it.taxRatePercent ?? null,
      tax_cents: it.taxCents ?? null,
      fee_name: it.feeName ?? null,
      fee_cents: it.feeCents ?? null,
      warehouse_name: it.warehouseName ?? null,
      warehouse_state: it.warehouseState ?? null,
      warehouse_gstin: it.warehouseGstin ?? null,
      gst_type: it.gstType ?? null,
      cgst_percent: it.cgstPercent ?? null,
      sgst_percent: it.sgstPercent ?? null,
      igst_percent: it.igstPercent ?? null,
      cgst_cents: it.cgstCents ?? null,
      sgst_cents: it.sgstCents ?? null,
      igst_cents: it.igstCents ?? null,
    })),
  };
}

const checkoutItemInput = z.object({
  product_id: z.string(),
  variant_id: z.string().optional().nullable(),
  quantity: z.number().min(1),
});

const addressInput = z.object({
  full_name: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  region: z.string().optional().nullable(),
  postal_code: z.string().min(1),
  country: z.string().min(1),
  // Must already be in E.164 format (e.g. "+919876543210") by the time it
  // reaches here — the client resolves the local number + selected country
  // into E.164 before submitting. Re-validated here (not just "non-empty")
  // because client-side validation can always be bypassed by a modified
  // client calling this server function directly.
  phone: z
    .string()
    .min(1)
    .refine(
      (val) => {
        try {
          return isValidPhoneNumber(val);
        } catch {
          return false;
        }
      },
      { message: "Phone number is not a valid E.164 number" },
    ),
  // Optional — but if a value IS provided, it still must be genuinely valid.
  // "Optional" means "may be omitted," not "may be garbage."
  alternate_phone: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        try {
          return isValidPhoneNumber(val);
        } catch {
          return false;
        }
      },
      { message: "Alternate contact number is not a valid E.164 number" },
    ),
});

const createOrderInput = z.object({
  items: z.array(checkoutItemInput).min(1),
  email: z.string().email(),
  shippingAddress: addressInput,
  billingAddress: addressInput.optional(),
  shippingZoneId: z.string().optional().nullable(),
  shippingRateId: z.string().optional().nullable(),
  discountCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(createOrderInput)
  .handler(async ({ data, context }) => {
    const { connectMongo } = await import("./client.server");
    const { Product } = await import("./models/product.server");
    const { TaxRate } = await import("./models/tax-rate.server");
    const { FeeCategory } = await import("./models/fee-category.server");
    const { ShippingZone } = await import("./models/shipping-zone.server");
    const { Order } = await import("./models/order.server");
    const { Warehouse } = await import("./models/warehouse.server");
    const { WarehouseStock } = await import("./models/warehouse-stock.server");
    await connectMongo();

    // 1. Look up live products — this is the authoritative price source.
    // Never trust a client-supplied unit price.
    const productIds = [...new Set(data.items.map((i) => i.product_id))];
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productById = new Map(products.map((p) => [p._id.toString(), p]));

    type LineItem = {
      productId: string;
      variantId: string | null;
      title: string;
      variantName: string | null;
      unitPriceCents: number;
      quantity: number;
      imageUrl: string | null;
      taxRateId: string | null;
      priceIncludesTax: boolean;
      feeCategoryId: string | null;
      // Populated below, in the tax/fee calculation loop — not known yet
      // when the line item is first built from the cart + product lookup.
      taxRateName?: string;
      taxRatePercent?: number;
      lineTaxCents?: number;
      feeName?: string;
      lineFeeCents?: number;
      warehouseId?: string;
      warehouseName?: string;
      warehouseState?: string;
      warehouseGstin?: string | null;
      gstType?: "intrastate" | "interstate" | "unknown";
      cgstPercent?: number;
      sgstPercent?: number;
      igstPercent?: number;
      cgstCents?: number;
      sgstCents?: number;
      igstCents?: number;
    };

    const lineItems: LineItem[] = [];
    for (const item of data.items) {
      const product = productById.get(item.product_id);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      if (product.status !== "active") throw new Error(`"${product.title}" is not currently available`);

      let unitPriceCents = product.priceCents;
      let variantName: string | null = null;
      let imageUrl = product.images?.[0] ?? null;

      if (item.variant_id) {
        const variant = (product.variants ?? []).find((v: any) => v._id.toString() === item.variant_id);
        if (!variant) throw new Error(`Variant not found for product "${product.title}"`);
        if (variant.priceCents != null) unitPriceCents = variant.priceCents;
        variantName = variant.name;
        if (variant.imageUrl) imageUrl = variant.imageUrl;
      }

      lineItems.push({
        productId: item.product_id,
        variantId: item.variant_id ?? null,
        title: product.title,
        variantName,
        unitPriceCents,
        quantity: item.quantity,
        imageUrl,
        taxRateId: product.taxRateId ? product.taxRateId.toString() : null,
        priceIncludesTax: product.priceIncludesTax ?? false,
        feeCategoryId: product.feeCategoryId ? product.feeCategoryId.toString() : null,
      });
    }

    const subtotalCents = lineItems.reduce((sum, li) => sum + li.unitPriceCents * li.quantity, 0);

    // 2. Tax + fees — ported from checkout.tsx's per-line loop.
    const taxRateIds = [...new Set(lineItems.map((li) => li.taxRateId).filter((x): x is string => !!x))];
    const feeCategoryIds = [...new Set(lineItems.map((li) => li.feeCategoryId).filter((x): x is string => !!x))];
    const [taxRates, feeCategories] = await Promise.all([
      TaxRate.find({ _id: { $in: taxRateIds } }).lean(),
      FeeCategory.find({ _id: { $in: feeCategoryIds } }).lean(),
    ]);
    const taxRateById = new Map(taxRates.map((t) => [t._id.toString(), t]));
    const feeCategoryById = new Map(feeCategories.map((f) => [f._id.toString(), f]));

    // Warehouse fulfillment + GST determination. Only engages if at least
    // one active warehouse exists — a store that never sets up warehouses
    // keeps the exact pre-existing behavior (flat TaxRate.ratePercent,
    // Product.stock decremented, no warehouse on the order item), so this
    // feature is additive, not a breaking change for stores that don't use it.
    const activeWarehouses = await Warehouse.find({ isActive: true }).lean();
    const usingWarehouses = activeWarehouses.length > 0;
    const buyerState = data.shippingAddress.region?.trim() || null;

    let taxExclusive = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let feeTotal = 0;
    let feeTaxExclusive = 0;
    const perOrderFees = new Map<string, (typeof feeCategories)[number]>();
    // Tracks warehouse -> (productId+variantId) -> quantity to decrement
    // after every line item is successfully resolved, so a failure partway
    // through (e.g. line 3 has no warehouse with enough stock) never
    // leaves line 1/2's stock already decremented for an order that didn't
    // actually get created.
    const stockDecrements: Array<{ warehouseId: string; productId: string; variantId: string | null; quantity: number }> = [];

    for (const li of lineItems) {
      const lineSubtotal = li.unitPriceCents * li.quantity;
      const taxRate = li.taxRateId ? taxRateById.get(li.taxRateId) : null;
      const taxPct = taxRate?.ratePercent ?? 0;

      if (taxRate) {
        li.taxRateName = taxRate.name;
        li.taxRatePercent = taxRate.ratePercent;
      }

      if (usingWarehouses) {
        // Find every active warehouse's stock for this exact product+variant.
        const stockRows = await WarehouseStock.find({
          productId: li.productId,
          variantId: li.variantId || null,
          warehouseId: { $in: activeWarehouses.map((w) => w._id) },
        }).lean();
        const stockByWarehouseId = new Map(stockRows.map((s) => [s.warehouseId.toString(), s.quantity]));

        const candidates = activeWarehouses.map((w) => ({
          id: w._id.toString(),
          name: w.name,
          state: w.state,
          gstin: w.gstin ?? null,
          priority: w.priority,
          availableQuantity: stockByWarehouseId.get(w._id.toString()) ?? 0,
        }));

        const chosen = selectFulfillingWarehouse(candidates, li.quantity);
        if (!chosen) {
          throw new Error(`"${li.title}"${li.variantName ? ` (${li.variantName})` : ""} is out of stock at all warehouses for the requested quantity`);
        }

        li.warehouseId = chosen.id;
        li.warehouseName = chosen.name;
        li.warehouseState = chosen.state;
        li.warehouseGstin = chosen.gstin;
        stockDecrements.push({ warehouseId: chosen.id, productId: li.productId, variantId: li.variantId, quantity: li.quantity });

        if (taxPct > 0) {
          // BUG FIX: this used to skip GST-split calculation entirely for
          // tax-inclusive products (the `!li.priceIncludesTax` guard
          // ported directly from the old flat-tax logic, without
          // reconsidering it for GST-split code). Inclusive tax means
          // "don't add tax on top of the price" — it does NOT mean "don't
          // report which portion of the price is tax." A GST-inclusive
          // product still needs its embedded tax correctly split into
          // CGST/SGST/IGST; only the "add to total" behavior differs.
          const taxableAmount = li.priceIncludesTax
            ? Math.round(lineSubtotal * (taxPct / (100 + taxPct))) // back out the embedded tax portion, same formula the checkout preview already used
            : lineSubtotal;
          const gst = determineGstSplit(taxableAmount, taxPct, chosen.state, buyerState, { amountIsAlreadyTax: li.priceIncludesTax });
          li.gstType = gst.type;
          li.cgstPercent = gst.cgstPercent;
          li.sgstPercent = gst.sgstPercent;
          li.igstPercent = gst.igstPercent;
          li.cgstCents = gst.cgstCents;
          li.sgstCents = gst.sgstCents;
          li.igstCents = gst.igstCents;
          li.lineTaxCents = gst.cgstCents + gst.sgstCents + gst.igstCents;
          cgstTotal += gst.cgstCents;
          sgstTotal += gst.sgstCents;
          igstTotal += gst.igstCents;
          // Only ADD to the charged total for exclusive tax — inclusive
          // tax is already part of unitPriceCents, so adding it again
          // here would double-charge the customer. It's still reported
          // (li.cgstCents etc. above) for correct invoice/GST-return
          // purposes; it just doesn't add to what's actually charged.
          if (!li.priceIncludesTax) {
            taxExclusive += li.lineTaxCents;
          }
          if (gst.type === "unknown") {
            // Surfaced as a real error rather than silently charging zero
            // or guessing a tax type — this should only happen if the
            // billing address genuinely has no usable state value, which
            // the address form's own validation should already prevent
            // for orders placed through the normal checkout flow.
            throw new Error(
              `Could not determine GST for "${li.title}" — the billing address state could not be matched. Please contact support.`,
            );
          }
        }
      } else if (taxPct > 0 && !li.priceIncludesTax) {
        // No warehouses configured — exact pre-existing flat-rate behavior.
        const lineTax = Math.round(lineSubtotal * (taxPct / 100));
        li.lineTaxCents = lineTax;
        taxExclusive += lineTax;
      }
      // tax-inclusive amounts are informational only in the original (not
      // added on top), so intentionally not accumulated into a charge here.

      const fee = li.feeCategoryId ? feeCategoryById.get(li.feeCategoryId) : null;
      if (fee) {
        if (fee.scope === "per_unit") {
          const feeAmt = (fee.amountCents ?? 0) * li.quantity + Math.round((lineSubtotal * (fee.percent ?? 0)) / 100);
          li.feeName = fee.name;
          li.lineFeeCents = feeAmt;
          feeTotal += feeAmt;
          if (fee.taxable && taxPct > 0) {
            if (usingWarehouses && li.warehouseState) {
              const feeTaxableAmount = li.priceIncludesTax ? Math.round(feeAmt * (taxPct / (100 + taxPct))) : feeAmt;
              const feeGst = determineGstSplit(feeTaxableAmount, taxPct, li.warehouseState, buyerState, { amountIsAlreadyTax: li.priceIncludesTax });
              cgstTotal += feeGst.cgstCents;
              sgstTotal += feeGst.sgstCents;
              igstTotal += feeGst.igstCents;
              li.lineTaxCents = (li.lineTaxCents ?? 0) + feeGst.cgstCents + feeGst.sgstCents + feeGst.igstCents;
              li.cgstCents = (li.cgstCents ?? 0) + feeGst.cgstCents;
              li.sgstCents = (li.sgstCents ?? 0) + feeGst.sgstCents;
              li.igstCents = (li.igstCents ?? 0) + feeGst.igstCents;
              // Same rule as the product tax above: only add to the
              // charged total for exclusive tax, since inclusive tax is
              // already embedded in the fee amount.
              if (!li.priceIncludesTax) {
                feeTaxExclusive += feeGst.cgstCents + feeGst.sgstCents + feeGst.igstCents;
              }
            } else if (!li.priceIncludesTax) {
              const feeTax = Math.round((feeAmt * taxPct) / 100);
              feeTaxExclusive += feeTax;
              // Fee tax is folded into the line's tax total too, so the
              // per-line "tax" figure shown to the customer matches what the
              // order-level aggregate actually charged for this line.
              li.lineTaxCents = (li.lineTaxCents ?? 0) + feeTax;
            }
          }
        } else if (!perOrderFees.has(fee._id.toString())) {
          perOrderFees.set(fee._id.toString(), fee);
        }
        // Per-order fees (scope !== "per_unit") are intentionally NOT
        // attributed to any single line — they're a whole-order charge,
        // shown separately in the order-level summary, same as before.
      }
    }
    for (const fee of perOrderFees.values()) {
      feeTotal += (fee.amountCents ?? 0) + Math.round((subtotalCents * (fee.percent ?? 0)) / 100);
    }

    // 3. Shipping — validate the selected rate actually belongs to an
    // active zone (never trust a bare rate id without checking its parent).
    let shippingCents = 0;
    let shippingMethodName: string | null = null;
    if (data.shippingZoneId && data.shippingRateId) {
      const zone = await ShippingZone.findOne({ _id: data.shippingZoneId, isActive: true }).lean();
      const rate = zone?.rates?.find((r: any) => r._id.toString() === data.shippingRateId && r.isActive);
      if (!rate) throw new Error("Selected shipping method is no longer available");
      shippingCents = rate.freeOverCents && subtotalCents >= rate.freeOverCents ? 0 : rate.priceCents;
      shippingMethodName = rate.name;
    }

    // 4. Discount — redeemDiscount atomically increments usage; if this
    // throws, no order is created and no usage is consumed (see below: we
    // only call it after everything else has been validated, so a discount
    // failure doesn't need to be "undone").
    let discountCents = 0;
    let redeemedDiscountCode: string | null = null;
    if (data.discountCode) {
      const preview = await previewDiscount(data.discountCode, subtotalCents);
      if (preview.type === "free_shipping") {
        discountCents = shippingCents;
        shippingCents = 0;
      } else {
        discountCents = Math.min(preview.discountCents, subtotalCents);
      }
      redeemedDiscountCode = preview.code;
    }

    const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents + feeTotal + taxExclusive + feeTaxExclusive);

    // Consume the discount only now, right before creating the order, so a
    // failure anywhere above never burns a usage count.
    if (data.discountCode) {
      await redeemDiscount(data.discountCode, subtotalCents);
    }

    // Currency is derived from the actual products purchased, not left to
    // fall through to a schema default (that silent fallthrough — landing
    // on the Order model's default rather than an explicit value — was the
    // actual root cause of orders showing USD regardless of store settings).
    // This store is single-currency in practice; if a cart somehow mixed
    // currencies, that's a real data problem worth surfacing loudly rather
    // than silently charging in whichever currency happened to be first.
    const orderCurrencies = new Set(lineItems.map((li) => productById.get(li.productId)?.currency).filter(Boolean));
    if (orderCurrencies.size > 1) {
      throw new Error("Cart contains items in different currencies — please contact support");
    }
    const orderCurrency = [...orderCurrencies][0] ?? DEFAULT_CURRENCY;

    const order = await Order.create({
      userId: context.userId,
      email: data.email,
      status: "pending",
      subtotalCents,
      shippingCents,
      taxCents: taxExclusive + feeTaxExclusive,
      cgstCents: cgstTotal,
      sgstCents: sgstTotal,
      igstCents: igstTotal,
      discountCents,
      feeCents: feeTotal,
      totalCents,
      currency: orderCurrency,
      shippingAddress: data.shippingAddress,
      billingAddress: data.billingAddress ?? data.shippingAddress,
      discountCode: redeemedDiscountCode,
      shippingMethod: shippingMethodName,
      notes: data.notes ?? undefined,
      items: lineItems.map((li) => ({
        productId: li.productId,
        variantId: li.variantId,
        title: li.title,
        variantName: li.variantName,
        unitPriceCents: li.unitPriceCents,
        quantity: li.quantity,
        imageUrl: li.imageUrl,
        lineSubtotalCents: li.unitPriceCents * li.quantity,
        taxRateName: li.taxRateName,
        taxRatePercent: li.taxRatePercent,
        taxCents: li.lineTaxCents,
        feeName: li.feeName,
        feeCents: li.lineFeeCents,
        warehouseId: li.warehouseId,
        warehouseName: li.warehouseName,
        warehouseState: li.warehouseState,
        warehouseGstin: li.warehouseGstin,
        gstType: li.gstType,
        cgstPercent: li.cgstPercent,
        sgstPercent: li.sgstPercent,
        igstPercent: li.igstPercent,
        cgstCents: li.cgstCents,
        sgstCents: li.sgstCents,
        igstCents: li.igstCents,
      })),
    });

    // Decrement stock ONLY after the order document itself is successfully
    // created — every validation and lookup above (products exist, prices,
    // warehouse selection, GST determination, discount redemption) has
    // already succeeded by this point, so this is the last step, not
    // something that could fail and leave stock wrongly decremented for
    // an order that was never actually placed. $inc with a floor guard
    // (quantity: { $gte: needed }) closes the same kind of race the
    // discount redemption logic already guards against: two concurrent
    // orders can't both succeed in decrementing below zero for the last
    // few units at one warehouse.
    if (usingWarehouses && stockDecrements.length > 0) {
      await Promise.all(
        stockDecrements.map((d) =>
          WarehouseStock.updateOne(
            { warehouseId: d.warehouseId, productId: d.productId, variantId: d.variantId || null, quantity: { $gte: d.quantity } },
            { $inc: { quantity: -d.quantity } },
          ),
        ),
      );
      // Deliberately not checking matchedCount/verifying success here: the
      // stock check already happened moments earlier when warehouses were
      // selected, so this is closing a narrow concurrent-order race, not
      // the primary correctness check. A very rare failure here (someone
      // else's order raced in between) leaves stock very slightly
      // optimistic rather than blocking an already-confirmed, already-
      // paid-for order after the fact — an admin can reconcile a stock
      // count; they can't un-create a confirmed order cleanly.
    } else if (!usingWarehouses) {
      // No warehouses configured — decrement the original single Product.stock
      // field, matching the pre-existing (pre-warehouse-feature) behavior.
      const { Product: ProductModel } = await import("./models/product.server");
      await Promise.all(
        lineItems.map((li) =>
          li.variantId
            ? ProductModel.updateOne(
                { _id: li.productId, "variants._id": li.variantId, "variants.stock": { $gte: li.quantity } },
                { $inc: { "variants.$.stock": -li.quantity } },
              )
            : ProductModel.updateOne({ _id: li.productId, stock: { $gte: li.quantity } }, { $inc: { stock: -li.quantity } }),
        ),
      );
    }

    return serializeOrder(order);
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { connectMongo } = await import("./client.server");
    const { Order } = await import("./models/order.server");
    await connectMongo();
    const orders = await Order.find({ userId: context.userId }).sort({ createdAt: -1 }).lean();
    return orders.map(serializeOrder);
  });

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { connectMongo } = await import("./client.server");
    const { Order } = await import("./models/order.server");
    await connectMongo();
    // Ownership enforced in the query itself, not checked after the fact —
    // a customer can never fetch another customer's order by guessing an id.
    const order = await Order.findOne({ _id: data.id, userId: context.userId }).lean();
    return order ? serializeOrder(order) : null;
  });

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { connectMongo } = await import("./client.server");
    const { Order } = await import("./models/order.server");
    await connectMongo();
    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    return orders.map(serializeOrder);
  });

export const adminGetOrder = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Order } = await import("./models/order.server");
    await connectMongo();
    const order = await Order.findById(data.id).lean();
    return order ? serializeOrder(order) : null;
  });

const updateOrderStatusInput = z.object({
  id: z.string(),
  status: z.enum(ORDER_STATUSES).optional(),
  tracking_number: z.string().optional().nullable(),
  carrier: z.string().optional().nullable(),
  tracking_url: z.string().optional().nullable(),
  admin_note: z.string().optional().nullable(),
});

export const adminUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(updateOrderStatusInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { Order } = await import("./models/order.server");
    await connectMongo();

    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "shipped") patch.shippedAt = new Date();
      if (data.status === "delivered") patch.deliveredAt = new Date();
    }
    if (data.tracking_number !== undefined) patch.trackingNumber = data.tracking_number;
    if (data.carrier !== undefined) patch.carrier = data.carrier;
    if (data.tracking_url !== undefined) patch.trackingUrl = data.tracking_url;
    if (data.admin_note !== undefined) patch.adminNote = data.admin_note;

    const updated = await Order.findByIdAndUpdate(data.id, { $set: patch }, { new: true });
    if (!updated) throw new Error("Order not found");
    return serializeOrder(updated);
  });
