// Server-only.
//
// Fulfillment rule: among warehouses with enough stock for this line item,
// pick the one with the lowest `priority` number (admin-configured "prefer
// this warehouse first" ordering). If no single warehouse has enough stock,
// this returns null — createOrder treats that as "insufficient stock",
// same as the original single-stock-number behavior, rather than silently
// splitting one line item across multiple warehouses (partial-shipment
// logic is a real, separate feature this does not attempt to solve).
export type WarehouseCandidate = {
  id: string;
  name: string;
  state: string;
  gstin: string | null;
  priority: number;
};

export function selectFulfillingWarehouse(
  candidates: Array<WarehouseCandidate & { availableQuantity: number }>,
  quantityNeeded: number,
): WarehouseCandidate | null {
  const eligible = candidates
    .filter((c) => c.availableQuantity >= quantityNeeded)
    .sort((a, b) => a.priority - b.priority);
  return eligible[0] ?? null;
}
