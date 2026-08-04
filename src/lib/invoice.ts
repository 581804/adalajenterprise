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
  }>;
};

type InvoiceBrand = {
  brand_name?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "INR" }).format((cents ?? 0) / 100);
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

  // Header
  doc.setFontSize(18);
  doc.text(brand.brand_name || "Invoice", 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (brand.contact_email) doc.text(brand.contact_email, 14, 26);
  if (brand.contact_phone) doc.text(brand.contact_phone, 14, 31);

  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(`Invoice for Order ${order.order_number}`, pageWidth - 14, 20, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: "long" }), pageWidth - 14, 26, { align: "right" });
  doc.text(order.email, pageWidth - 14, 31, { align: "right" });

  // Addresses
  let y = 42;
  doc.setTextColor(0);
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

  // Line items table — includes a per-line Tax column when the order has
  // that data (orders placed after per-line tax tracking was added); shows
  // "—" for older orders where only the order-level aggregate exists.
  const hasLineTax = order.order_items.some((item) => item.tax_cents != null);
  autoTable(doc, {
    startY: y,
    head: hasLineTax
      ? [["Item", "Qty", "Unit price", "Tax", "Line total"]]
      : [["Item", "Qty", "Unit price", "Line total"]],
    body: order.order_items.map((item) => {
      const label = item.variant_name ? `${item.title} (${item.variant_name})` : item.title;
      const lineTotal = money(item.unit_price_cents * item.quantity, currency);
      const row = [label, String(item.quantity), money(item.unit_price_cents, currency)];
      if (hasLineTax) {
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
    headStyles: { fillColor: [30, 30, 30] },
    styles: { fontSize: 9 },
  });

  // Totals — right-aligned block after the table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterTableY = (doc as any).lastAutoTable.finalY + 10;
  const totalsX = pageWidth - 14;
  const labelX = totalsX - 55;
  let ty = afterTableY;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    doc.text(label, labelX, ty);
    doc.text(value, totalsX, ty, { align: "right" });
    ty += bold ? 7 : 6;
  };

  row("Subtotal", money(order.subtotal_cents, currency));
  row(order.shipping_method ? `Shipping (${order.shipping_method})` : "Shipping", money(order.shipping_cents, currency));
  if (order.fee_cents > 0) row("Fees", money(order.fee_cents, currency));
  if (order.tax_cents > 0) row("Tax", money(order.tax_cents, currency));
  if (order.discount_cents > 0) {
    row(order.discount_code ? `Discount (${order.discount_code})` : "Discount", `-${money(order.discount_cents, currency)}`);
  }
  doc.setDrawColor(200);
  doc.line(labelX, ty - 3, totalsX, ty - 3);
  row("Total", money(order.total_cents, currency), true);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text("This invoice was generated automatically and does not require a signature.", 14, doc.internal.pageSize.getHeight() - 10);

  doc.save(`invoice-${order.order_number}.pdf`);
}
