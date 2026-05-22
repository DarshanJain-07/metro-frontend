import * as z from "zod";

export const lineItemSchema = z.object({
  item_type: z.string().min(1, "Item type is required"),
  package_type: z.string().min(1, "Package type is required"),
  rate_type: z.string().min(1, "Rate type is required"),
  pieces: z.union([z.string(), z.number()]).refine((value) => Number(value) >= 1, "Pieces must be at least 1"),
  actual_weight: z.string(),
  charged_weight: z.string(),
  rate: z.string(),
  charge: z.string(),
});

export const docketSchema = z.object({
  date: z.string().min(1, "Date is required"),
  status: z.string().min(1),
  docket_no: z.string().optional(),
  to_city: z.string().min(1, "Destination city is required"),
  destination_branch: z.string().min(1, "Destination branch is required"),
  basis: z.string().min(1, "Basis is required"),
  payment_type: z.string().min(1, "Payment type is required"),
  mode: z.string().min(1, "Mode is required"),
  delivery_type: z.string().min(1, "Delivery type is required"),
  consignor_name: z.string().min(1, "Consignor name is required"),
  consignor_city: z.string().min(1, "Consignor city is required"),
  consignor_phone: z.string().min(10, "Consignor phone is required"),
  consignor_address: z.string().min(1, "Consignor address is required"),
  consignee_name: z.string().min(1, "Consignee name is required"),
  consignee_city: z.string().min(1, "Consignee city is required"),
  consignee_phone: z.string().min(10, "Consignee phone is required"),
  consignee_address: z.string().min(1, "Consignee address is required"),
  gst_party: z.string().optional(),
  gst_number: z.string().optional(),
  notes: z.string().optional(),
  additional_charges: z.string(),
  delivery_charge: z.string(),
  advance_amount: z.string(),
  idempotency_key: z.string().min(1),
  line_items: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

export type DocketFormValues = z.infer<typeof docketSchema>;
export type LineItemValues = z.infer<typeof lineItemSchema>;
