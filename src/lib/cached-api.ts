import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { API_URL } from "@/lib/api";

const CitySchema = z.object({
  id: z.string(),
  name: z.string(),
});

const CitiesResponseSchema = z.union([
  z.array(CitySchema),
  z.object({
    results: z.array(CitySchema),
  }),
]);

export type City = z.infer<typeof CitySchema>;

function createCompanyHeaders(companyId?: string): Headers {
  const headers = new Headers();

  if (companyId) {
    headers.set("X-Company-ID", companyId);
  }

  return headers;
}

function parseCitiesResponse(json: unknown): City[] {
  const parsed = CitiesResponseSchema.safeParse(json);

  if (!parsed.success) {
    return [];
  }

  return Array.isArray(parsed.data) ? parsed.data : parsed.data.results;
}

export async function getCachedCities(companyId?: string): Promise<City[]> {
  "use cache";

  cacheLife("masterData");

  if (companyId) {
    cacheTag("cities", `cities-${companyId}`);
  } else {
    cacheTag("cities");
  }

  const response = await fetch(`${API_URL}/api/v1/master/cities/`, {
    headers: createCompanyHeaders(companyId),
  });

  if (!response.ok) {
    return [];
  }

  const json: unknown = await response.json();

  return parseCitiesResponse(json);
}

export async function getCachedDashboardStats(companyId: string) {
  "use cache";

  cacheLife("dashboard");
  cacheTag("dashboard", `dashboard-${companyId}`);

  const url = new URL(`${API_URL}/api/v1/dashboard/`);
  url.searchParams.set("company_id", companyId);

  const response = await fetch(url, {
    headers: createCompanyHeaders(companyId),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
  }

  return response.json();
}
