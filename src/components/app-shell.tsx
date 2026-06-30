"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { ContentSkeleton } from "@/components/app-skeleton";
import { getRequiredPermissions } from "@/lib/routes";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import {
  buildAuthUrl,
  buildCurrentPathRedirect,
  getAuthRedirectFromSearchParams,
  LAST_AUTH_REDIRECT_STORAGE_KEY,
  isAuthRoute,
  normalizeAuthRedirect,
} from "@/lib/auth-redirect";

const APP_SESSION_IDLE_TIMEOUT_MINUTES = Number(
  process.env.NEXT_PUBLIC_APP_SESSION_IDLE_TIMEOUT_MINUTES || "15",
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const router = useRouter();
  const { user, isLoading, authError, can } = useAuth();

  const isAuthPage = isAuthRoute(pathname);
  const isPrintPage = pathname.endsWith("/print") || pathname.includes("/print/");
  const requiredPermissions = getRequiredPermissions(pathname);

  useInactivityTimeout({
    enabled: Boolean(user && !isAuthPage && !isPrintPage),
    timeoutMinutes: APP_SESSION_IDLE_TIMEOUT_MINUTES,
  });

  useEffect(() => {
    const currentSearchParams = new URLSearchParams(search);

    if (user && isAuthPage && !isPrintPage) {
      const fallback = normalizeAuthRedirect(
        localStorage.getItem(LAST_AUTH_REDIRECT_STORAGE_KEY),
      );
      router.replace(getAuthRedirectFromSearchParams(currentSearchParams, fallback));
      return;
    }

    if (user && !isAuthPage && !isPrintPage) {
      localStorage.setItem(
        LAST_AUTH_REDIRECT_STORAGE_KEY,
        buildCurrentPathRedirect(pathname, currentSearchParams),
      );
      return;
    }

    if (
      !isLoading &&
      !user &&
      !isAuthPage &&
      !isPrintPage
    ) {
      router.replace(
        buildAuthUrl("/sign-in", buildCurrentPathRedirect(pathname, currentSearchParams)),
      );
    }
  }, [
    isLoading,
    user,
    isAuthPage,
    isPrintPage,
    pathname,
    router,
    search,
  ]);

  if (isPrintPage) {
    return (
      <main className="h-full bg-white">
        {children}
      </main>
    );
  }

  if (isAuthPage) {
    return (
      <>
        <Navbar />
        <main className="min-h-0 flex-1 overflow-auto bg-background">
          {children}
        </main>
      </>
    );
  }

  // Check route-level permissions
  const hasRoutePermission = !isLoading && requiredPermissions
    ? requiredPermissions.some((permission) => can(permission))
    : true;

  return (
    <>
      <Navbar />
      <div className="min-h-0 flex-1 flex overflow-hidden bg-background">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="animate-fade-in h-full flex flex-col">
            {isLoading ? (
              <ContentSkeleton />
            ) : !user && authError ? (
              <div className="p-4 h-full flex items-center justify-center text-center text-muted-foreground font-medium">
                {authError}
              </div>
            ) : hasRoutePermission ? (
              children
            ) : (
              <div className="p-4 h-full flex items-center justify-center text-muted-foreground font-medium">
                Access Denied: You do not have permission to view this page.
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
