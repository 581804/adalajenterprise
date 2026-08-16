import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type InvoiceOrder = {
  order_number: string;
  created_at: string | Date;
  email: string;
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  shipping_method?: string | null;
  fee_cents: number;
  tax_cents: number;
  cgst_cents?: number;
  sgst_cents?: number;
  igst_cents?: number;
  discount_cents: number;
  discount_code?: string | null;
  total_cents: number;
  shipping_address?: Record<string, any>;
  billing_address?: Record<string, any>;
  order_items: Array<{
    title: string;
    variant_name?: string | null;
    unit_price_cents: number;
    quantity: number;
    tax_cents?: number | null;
    tax_rate_percent?: number | null;
    gst_type?: "intrastate" | "interstate" | "unknown" | null;
    cgst_percent?: number | null;
    sgst_percent?: number | null;
    igst_percent?: number | null;
    warehouse_name?: string | null;
    warehouse_state?: string | null;
    warehouse_gstin?: string | null;
  }>;
};

type InvoiceBrand = {
  brand_name?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
};

function money(cents: number, currency: string) {
  // Deliberately NOT using Intl.NumberFormat's currency symbol here.
  // jsPDF's default fonts (the old PDF standard-14 set) have no glyph for
  // ₹ or most non-Latin1 currency symbols — the character is silently
  // dropped rather than erroring, which is what produced the broken
  // rendering seen in testing. Using the plain currency CODE ("INR", "USD",
  // etc.) instead is guaranteed ASCII and renders correctly in any font.
  // Verified by rasterizing actual jsPDF output before shipping this fix.
  const value = (cents ?? 0) / 100;
  const formatted = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency || "INR"} ${formatted}`;
}

function formatAddress(addr?: Record<string, any>) {
  if (!addr) return [];
  return [
    addr.full_name,
    addr.line1,
    addr.line2,
    [addr.city, addr.region, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
    addr.phone,
    addr.alternate_phone ? `Alt: ${addr.alternate_phone}` : null,
  ].filter(Boolean);
}

/**
 * Generates and triggers a browser download of an invoice PDF for the given
 * order. Runs entirely client-side (no server round-trip) — the order data
 * is already in hand from getMyOrder/adminGetOrder by the time this is
 * called, so there's nothing to fetch.
 */
export function downloadInvoice(order: InvoiceOrder, brand: InvoiceBrand = {}) {
  const doc = new jsPDF();
  const currency = order.currency || "INR";
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(23, 37, 32); // dark green, matches this store's branding direction
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(brand.brand_name || "Invoice", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const contactLine = [brand.contact_email, brand.contact_phone].filter(Boolean).join("  ·  ");
  if (contactLine) doc.text(contactLine, 14, 24);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`INVOICE`, pageWidth - 14, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`#${order.order_number}`, pageWidth - 14, 21, { align: "right" });
  doc.text(new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }), pageWidth - 14, 27, { align: "right" });

  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.text(order.email, pageWidth - 14, 40, { align: "right" });

  // Sold-by / GSTIN info — a real GST invoice requirement. Listed per
  // distinct warehouse actually involved (not a single header field),
  // since a multi-warehouse order can legitimately have more than one
  // seller-of-record for different lines. Deduplicated so an order with
  // several lines from the same warehouse doesn't repeat it.
  const distinctSellers = Array.from(
    new Map(
      order.order_items
        .filter((item) => item.warehouse_name)
        .map((item) => [item.warehouse_name, { name: item.warehouse_name, state: item.warehouse_state, gstin: item.warehouse_gstin }]),
    ).values(),
  );
  let y = 40;
  if (distinctSellers.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Sold by", 14, y);
    doc.setFont("helvetica", "normal");
    for (const seller of distinctSellers) {
      y += 5;
      const parts = [seller.name, seller.state, seller.gstin ? `GSTIN: ${seller.gstin}` : null].filter(Boolean);
      doc.text(parts.join(" · "), 14, y);
    }
    y += 6;
  } else {
    y += 8;
  }

  // Addresses
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Billing address", 14, y);
  doc.text("Shipping address", pageWidth / 2 + 4, y);
  doc.setFont("helvetica", "normal");
  const billing = formatAddress(order.billing_address ?? order.shipping_address);
  const shipping = formatAddress(order.shipping_address);
  const maxLines = Math.max(billing.length, shipping.length);
  for (let i = 0; i < maxLines; i++) {
    doc.text(billing[i] ?? "", 14, y + 6 + i * 5);
    doc.text(shipping[i] ?? "", pageWidth / 2 + 4, y + 6 + i * 5);
  }
  y += 6 + maxLines * 5 + 8;

  // Line items table. Real GST invoices show CGST/SGST/IGST as separate
  // columns, not one lump "Tax" — using that convention whenever the order
  // has GST data (from a warehouse-fulfilled order). Falls back to the
  // older single Tax column for orders placed before warehouses existed.
  const hasGstData = order.order_items.some((item) => item.gst_type != null && item.gst_type !== "unknown");
  const hasLineTax = order.order_items.some((item) => item.tax_cents != null);
  autoTable(doc, {
    startY: y,
    head: hasGstData
      ? [["Item", "Qty", "Unit price", "CGST", "SGST", "IGST", "Line total"]]
      : hasLineTax
        ? [["Item", "Qty", "Unit price", "Tax", "Line total"]]
        : [["Item", "Qty", "Unit price", "Line total"]],
    body: order.order_items.map((item) => {
      const label = item.variant_name ? `${item.title} (${item.variant_name})` : item.title;
      const lineTotal = money(item.unit_price_cents * item.quantity, currency);
      const row = [label, String(item.quantity), money(item.unit_price_cents, currency)];
      if (hasGstData) {
        const isIntrastate = item.gst_type === "intrastate";
        const isInterstate = item.gst_type === "interstate";
        row.push(isIntrastate && item.cgst_percent ? `${item.cgst_percent}%` : "—");
        row.push(isIntrastate && item.sgst_percent ? `${item.sgst_percent}%` : "—");
        row.push(isInterstate && item.igst_percent ? `${item.igst_percent}%` : "—");
      } else if (hasLineTax) {
        row.push(
          item.tax_cents != null
            ? `${money(item.tax_cents, currency)}${item.tax_rate_percent ? ` (${item.tax_rate_percent}%)` : ""}`
            : "—",
        );
      }
      row.push(lineTotal);
      return row;
    }),
    theme: "striped",
    headStyles: { fillColor: [23, 37, 32] },
    styles: { fontSize: 9 },
  });

  // Totals — right-aligned block after the table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterTableY = (doc as any).lastAutoTable.finalY + 8;
  const totalsX = pageWidth - 18;
  const labelX = totalsX - 55;
  let ty = afterTableY;
  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(60);
    doc.text(label, labelX, ty);
    doc.text(value, totalsX, ty, { align: "right" });
    ty += 6;
  };

  row("Subtotal", money(order.subtotal_cents, currency));
  row(order.shipping_method ? `Shipping (${order.shipping_method})` : "Shipping", money(order.shipping_cents, currency));
  if (order.fee_cents > 0) row("Fees", money(order.fee_cents, currency));
  const hasGstAggregates = (order.cgst_cents ?? 0) > 0 || (order.sgst_cents ?? 0) > 0 || (order.igst_cents ?? 0) > 0;
  if (hasGstAggregates) {
    if (order.cgst_cents) row("CGST", money(order.cgst_cents, currency));
    if (order.sgst_cents) row("SGST", money(order.sgst_cents, currency));
    if (order.igst_cents) row("IGST", money(order.igst_cents, currency));
  } else if (order.tax_cents > 0) {
    row("Tax", money(order.tax_cents, currency));
  }
  if (order.discount_cents > 0) {
    row(order.discount_code ? `Discount (${order.discount_code})` : "Discount", `-${money(order.discount_cents, currency)}`);
  }

  // Highlighted total row — filled background, not just a rule, so it
  // actually stands out the way a "richer" invoice's total block should.
  ty += 2;
  doc.setFillColor(23, 37, 32);
  doc.rect(labelX - 4, ty - 5, totalsX - labelX + 4 + 4, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", labelX, ty);
  doc.text(money(order.total_cents, currency), totalsX, ty, { align: "right" });
  ty += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text("This invoice was generated automatically and does not require a signature.", 14, doc.internal.pageSize.getHeight() - 10);

  doc.save(`invoice-${order.order_number}.pdf`);
}
