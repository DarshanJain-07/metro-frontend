import type { DocketFormValues } from "./schema";
import { calculateLineItemCharge } from "./charges";

type ApiError = Record<string, unknown>;

function formatApiError(error: ApiError): string {
  if (typeof error.detail === "string") {
    return error.detail;
  }

  const firstEntry = Object.entries(error)[0];
  if (!firstEntry) {
    return "Failed to create docket";
  }

  const [field, messages] = firstEntry;
  if (Array.isArray(messages)) {
    return `${field}: ${messages.join(", ")}`;
  }
  if (typeof messages === "object" && messages !== null) {
    return `${field}: ${formatApiError(messages as ApiError)}`;
  }
  return `${field}: ${String(messages)}`;
}

function money(value?: string | number) {
  const num = Number(value || 0);
  if (isNaN(num)) return "0.00";
  return num.toFixed(2);
}

function normalizeDocketPayload(data: DocketFormValues) {
  return {
    ...data,
    to_city: Number(data.to_city),
    destination_branch: Number(data.destination_branch),
    consignor_city: Number(data.consignor_city),
    consignee_city: Number(data.consignee_city),
    gst_party: data.gst_party || data.consignor_name,
    gst_number: data.gst_number || null,
    additional_charges: money(data.additional_charges),
    delivery_charge: money(data.delivery_charge),
    advance_amount: money(data.advance_amount),
    line_items: data.line_items.map((item) => ({
      ...item,
      pieces: Number(item.pieces),
      actual_weight: money(item.actual_weight),
      charged_weight: money(item.charged_weight),
      rate: money(item.rate),
      charge: money(calculateLineItemCharge(item)),
    })),
  };
}

export async function createDocket(data: DocketFormValues, token: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const payload = normalizeDocketPayload(data);

  try {
    const response = await fetch(`${apiUrl}/api/v1/new/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Idempotency-Key": data.idempotency_key,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      return {
        success: false,
        status: response.status,
        error: "Authentication session expired. Please log in again.",
      };
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: formatApiError(result),
      };
    }

    return {
      success: true,
      status: response.status,
      data: result,
    };
  } catch (error) {
    console.error("Action error:", error);
    return {
      success: false,
      error: "A network error occurred",
    };
  }
}
