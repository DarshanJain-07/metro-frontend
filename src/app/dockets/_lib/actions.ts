export interface DocketListItem {
  id: number;
  docket_no: string;
  date: string;
  consignor_name: string;
  consignee_name: string;
  to_city_name: string;
  status: string;
  total_amount: string;
  payment_type: string;
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
  from_date?: string;
  to_date?: string;
  consignor_name?: string;
}

export async function getDockets(filters: DocketFilters, token: string): Promise<{
  success: boolean;
  data?: DocketsResponse;
  error?: string;
}> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const url = new URL(`${apiUrl}/api/v1/dockets/`);
  
  if (filters.page) url.searchParams.append("page", String(filters.page));
  if (filters.page_size) url.searchParams.append("page_size", String(filters.page_size));
  if (filters.from_date) url.searchParams.append("from_date", filters.from_date);
  if (filters.to_date) url.searchParams.append("to_date", filters.to_date);
  if (filters.consignor_name) url.searchParams.append("consignor_name", filters.consignor_name);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

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
        error: result.detail || "Failed to fetch dockets",
      };
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Fetch dockets error:", error);
    return {
      success: false,
      error: "A network error occurred",
    };
  }
}
