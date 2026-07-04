import {
  fetchWithAuth,
  getApiErrorMessage,
  readApiError,
} from "@/lib/api";
import { formatDateForApi } from "@/lib/utils";
import type { DocketFormValues } from "./schema";

export interface DocketListItem {
  id: string;
  docket_no: string;
  date: string;
  origin_office?: string;
  origin_office_name?: string;
  destination_office_name?: string;
  consignor_name: string;
  consignee_name: string;
  to_city_name: string;
  status: string;
  total_amount: string;
  payment_type: string;
  delivery_type?: string;
  available_actions?: string[];
}

export interface DocketsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DocketListItem[];
}

export interface DocketFilters {
  page?: number;
  page_size?: number;
  scope?: "outgoing" | "incoming" | "all";
  from_date?: string;
  to_date?: string;
  consignor_name?: string;
  origin_branch?: string;
  destination_branch?: string;
  status?: string;
  delivery_type?: string;
  search?: string;
}

interface GetDocketsOptions {
  apiPath?: string;
  signal?: AbortSignal;
}

export type DocketLineItem = DocketFormValues["line_items"][number] & {
  id?: string | number;
};

export type DocketDetail = DocketFormValues & {
  available_actions?: string[];
  company_name?: string | null;
  lr_no?: string | null;
  docket_no?: string | null;
  total_amount?: string | number | null;
  origin_office?: string | number | null;
  origin_office_name?: string | null;
  destination_office?: string | number | null;
  destination_office_name?: string | null;
  destination_branch_name?: string | null;
  freight?: string | number | null;
  final_freight?: string | number | null;
  remaining_balance?: string | number | null;
  total_packages?: string | number | null;
  total_actual_weight?: string | number | null;
  total_charge_weight?: string | number | null;
  to_city_name?: string | null;
  consignor_city_name?: string | null;
  consignee_city_name?: string | null;
  line_items: DocketLineItem[];
};

function money(value?: string | number) {
  const num = Number(value || 0);
  if (isNaN(num)) return "0.00";
  return num.toFixed(2);
}

function normalizeDocketPayload(data: DocketFormValues) {
  return {
    ...data,
    date: formatDateForApi(data.date),
    ...(data.origin_branch ? { origin_office: data.origin_branch } : {}),
    to_city: data.to_city,
    destination_office: data.destination_branch,
    consignor_city: data.consignor_city,
    consignee_city: data.consignee_city,
    gst_party: data.gst_party || data.consignor_name,
    gst_number: data.gst_number || null,
    additional_charges: money(data.additional_charges),
    delivery_charge: money(data.delivery_charge),
    advance_amount: money(data.advance_amount),
    updated_at: data.updated_at,
    line_items: data.line_items.map((item) => ({
      ...item,
      pieces: Number(item.pieces),
      actual_weight: money(item.actual_weight),
      charged_weight: money(item.charged_weight),
      rate: money(item.rate),
      charge: money(item.charge),
    })),
  };
}

export async function getDockets(
  filters: DocketFilters,
  options: GetDocketsOptions = {},
): Promise<{
  success: boolean;
  data?: DocketsResponse;
  error?: string;
}> {
  const apiPath = options.apiPath || "/api/v1/shipments/";
  const isIncomingEndpoint = apiPath.includes("/shipments/incoming/");
  const searchParams = new URLSearchParams();
  if (filters.page) searchParams.append("page", String(filters.page));
  if (filters.page_size)
    searchParams.append("page_size", String(filters.page_size));
  if (filters.scope && !isIncomingEndpoint)
    searchParams.append("scope", filters.scope);
  if (filters.from_date) searchParams.append("from_date", filters.from_date);
  if (filters.to_date) searchParams.append("to_date", filters.to_date);
  if (filters.consignor_name)
    searchParams.append("consignor_name", filters.consignor_name);
  if (filters.origin_branch)
    searchParams.append("origin_office", filters.origin_branch);
  if (filters.destination_branch && !isIncomingEndpoint)
    searchParams.append("destination_office", filters.destination_branch);
  if (filters.status) searchParams.append("status", filters.status);
  if (filters.delivery_type) searchParams.append("delivery_type", filters.delivery_type);
  if (filters.search) searchParams.append("search", filters.search);

  const queryString = searchParams.toString();
  const path = queryString ? `${apiPath}?${queryString}` : apiPath;

  try {
    const response = await fetchWithAuth(path, { signal: options.signal });
    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      return { success: false, error: "Authentication session expired." };
    }

    if (!response.ok) {
      return {
        success: false,
        error: getApiErrorMessage(result, {
          status: response.status,
          fallback: "Could not load dockets.",
        }),
      };
    }

    return { success: true, data: result };
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }
    return {
      success: false,
      error: "Network error while loading dockets. Please check your connection.",
    };
  }
}

export async function getDocket(
  id: string | number,
  options: RequestInit = {},
): Promise<{
  success: boolean;
  data?: DocketDetail;
  error?: string;
}> {
  try {
    const response = await fetchWithAuth(`/api/v1/shipments/${id}/`, options);
    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      return { success: false, error: "Authentication session expired." };
    }

    if (!response.ok) {
      return {
        success: false,
        error: getApiErrorMessage(result, {
          status: response.status,
          fallback: "Could not load this docket.",
        }),
      };
    }

    return { success: true, data: result };
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }
    return {
      success: false,
      error: "Network error while loading this docket. Please check your connection.",
    };
  }
}

export async function createDocket(data: DocketFormValues) {
  const payload = normalizeDocketPayload(data);

  try {
    const response = await fetchWithAuth("/api/v1/shipments/", {
      method: "POST",
      headers: {
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
        error: getApiErrorMessage(result, {
          status: response.status,
          fallback: "Could not create docket.",
        }),
      };
    }

    return { success: true, status: response.status, data: result };
  } catch (error) {
    console.error("Create docket error:", error);
    return {
      success: false,
      error: "Network error while creating docket. Please check your connection.",
    };
  }
}

export async function updateDocket(
  id: string | number,
  data: DocketFormValues,
) {
  const payload = normalizeDocketPayload(data);

  try {
    const response = await fetchWithAuth(`/api/v1/shipments/${id}/`, {
      method: "PATCH",
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
        error: getApiErrorMessage(result, {
          status: response.status,
          fallback: "Could not update docket.",
        }),
      };
    }

    return { success: true, status: response.status, data: result };
  } catch (error) {
    console.error("Update docket error:", error);
    return {
      success: false,
      error: "Network error while updating docket. Please check your connection.",
    };
  }
}

export async function receiveDocket(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetchWithAuth(`/api/v1/shipments/${id}/receive/`, {
      method: "POST",
    });

    if (!response.ok) {
      return {
        success: false,
        error: await readApiError(response, "Could not receive docket."),
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: "Network error while receiving docket. Please check your connection.",
    };
  }
}

export async function markDelivered(
  id: string,
  podData: {
    received_by_name: string;
    received_by_phone?: string;
    delivery_notes?: string;
    delivered_at?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetchWithAuth(
      `/api/v1/shipments/${id}/mark-delivered/`,
      {
        method: "POST",
        body: JSON.stringify(podData),
      },
    );

    if (!response.ok) {
      return {
        success: false,
        error: await readApiError(response, "Could not mark docket as delivered."),
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: "Network error while marking docket as delivered. Please check your connection.",
    };
  }
}
