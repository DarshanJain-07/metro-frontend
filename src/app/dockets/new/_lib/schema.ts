import { z } from "zod";

const numericString = z.coerce.number().min(0, "Must be positive");
const phoneString = z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits");

export const lineItemSchema = z.object({
  item_type: z.string().min(1, "Item type is required"),
  package_type: z.string().min(1, "Package type is required"),
  rate_type: z.string().min(1, "Rate type is required"),
  pieces: z.coerce.number().int().min(1, "Pieces must be at least 1"),
  actual_weight: numericString,
  charged_weight: numericString,
  rate: numericString,
  charge: numericString,
});

export const docketSchema = z.object({
  date: z.string().min(1, "Date is required"),
  status: z.string().min(1),
  to_city: z.string().min(1, "Destination city is required"),
  destination_branch: z.string().min(1, "Destination branch is required"),
  basis: z.string().min(1, "Basis is required"),
  payment_type: z.string().min(1, "Payment type is required"),
  mode: z.string().min(1, "Mode is required"),
  delivery_type: z.string().min(1, "Delivery type is required"),
  consignor_name: z.string().min(1, "Consignor name is required"),
  consignor_city: z.string().min(1, "Consignor city is required"),
  consignor_phone: phoneString,
  consignor_address: z.string().min(1, "Consignor address is required"),
  consignee_name: z.string().min(1, "Consignee name is required"),
  consignee_city: z.string().min(1, "Consignee city is required"),
  consignee_phone: phoneString,
  consignee_address: z.string().min(1, "Consignee address is required"),
  gst_party: z.string().optional(),
  gst_number: z.string().optional(),
  notes: z.string().optional(),
  additional_charges: numericString,
  delivery_charge: numericString,
  advance_amount: numericString,
  idempotency_key: z.string().min(1),
  line_items: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

export type DocketFormValues = z.infer<typeof docketSchema>;
export type LineItemValues = z.infer<typeof lineItemSchema>;
