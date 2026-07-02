import { QueryClient } from "@tanstack/react-query";

import { shouldRetryQuery } from "@/lib/api";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        staleTime: 60_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
