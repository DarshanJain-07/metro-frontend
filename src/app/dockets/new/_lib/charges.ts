import type { LineItemValues } from "./schema";

export function calculateLineItemCharge(item?: Partial<LineItemValues>) {
  if (!item) {
    return 0;
  }

  const rate = Number(item.rate || 0);
  const pieces = Number(item.pieces || 0);
  const weight = Number(item.charged_weight || 0);

  if (item.rate_type === "PER_PIECE") {
    return Math.round(rate * pieces);
  }

  if (item.rate_type === "PER_KG") {
    return Math.round(rate * weight);
  }

  if (item.rate_type === "FLAT") {
    return Math.round(rate);
  }

  return 0;
}
