"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import {
  DEFAULT_AUTH_REDIRECT,
  getAuthRedirectFromSearchParams,
} from "@/lib/auth-redirect-core";

export * from "@/lib/auth-redirect-core";

export function useAuthRedirectTarget(
  fallback = DEFAULT_AUTH_REDIRECT,
): string {
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return useMemo(() => {
    return getAuthRedirectFromSearchParams(
      new URLSearchParams(search),
      fallback,
    );
  }, [fallback, search]);
}
