import { fetchWithAuth, getApiErrorMessage } from "@/lib/api";

export interface DocketListItem {
  id: string;
  docket_no: string;
  date: string;
  consignor_name: string;
  consignee_name: string;
  to_city_name: string;
  status: string;
  total_amount: string;
  payment_type: string;
  is_billed: boolean;
  payment_status: string;
  available_actions?: string[];
}

export interface DocketsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DocketListItem[];
}

export interface BillingFilters {
  page?: number;
  page_size?: number;
  from_date?: string;
  to_date?: string;
  customer_id?: string;
  show_billed?: boolean;
  exclude_paid?: boolean;
  search?: string;
  status?: string;
  origin_branch?: string;
  basis?: string;
  due_only?: boolean;
}

export async function getBillingDockets(filters: BillingFilters, options?: RequestInit): Promise<{
  success: boolean;
  data?: DocketsResponse;
  error?: string;
}> {
  const searchParams = new URLSearchParams();
  if (filters.page) searchParams.append("page", String(filters.page));
  if (filters.page_size) searchParams.append("page_size", String(filters.page_size));
  if (filters.from_date) searchParams.append("from_date", filters.from_date);
  if (filters.to_date) searchParams.append("to_date", filters.to_date);
  if (filters.customer_id) searchParams.append("party", filters.customer_id);
  
  if (filters.show_billed === true) {
    searchParams.append("is_billed", "true");
  } else {
    searchParams.append("is_billed", "false");
  }
  
  if (filters.exclude_paid) searchParams.append("exclude_paid", "true");
  if (filters.search) searchParams.append("search", filters.search);
  if (filters.status) searchParams.append("status", filters.status);
  if (filters.origin_branch) searchParams.append("origin_office", filters.origin_branch);
  if (filters.basis) searchParams.append("basis", filters.basis);
  if (filters.due_only) searchParams.append("payment_status", "UNPAID");

  const path = `/api/v1/shipments/?${searchParams.toString()}`;

  try {
    const response = await fetchWithAuth(path, options);
    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      return {
        success: false,
        error: "Authentication session expired.",
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: getApiErrorMessage(result, {
          status: response.status,
          fallback: "Could not load billing dockets.",
        }),
      };
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }
    return {
      success: false,
      error: "Network error while loading billing dockets. Please check your connection.",
    };
  }
}

export async function generateBillForDockets(docketIds: string[], customerId?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetchWithAuth("/api/v1/shipments/bill/", {
      method: "POST",
      body: JSON.stringify({ shipment_ids: docketIds, party: customerId }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        error: getApiErrorMessage(result, {
          status: response.status,
          fallback: "Could not generate bill.",
        }),
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: "Network error while generating bill. Please check your connection.",
    };
  }
}

export async function getParties(options?: RequestInit) {
  try {
    const response = await fetchWithAuth("/api/v1/master/parties/?page_size=1000", options);
    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      return {
        success: true,
        data: result.results || [],
      };
    }
    return {
      success: false,
      error: getApiErrorMessage(result, {
        status: response.status,
        fallback: "Could not load parties.",
      }),
    };
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }
    return {
      success: false,
      error: "Network error while loading parties. Please check your connection.",
    };
  }
}
