export const AUTH_COOKIE_NAMES = {
  workosSession: "metro_workos_session",
  activeMembershipId: "metro_active_membership_id",
  activeCompanyId: "metro_active_company_id",
  activeOfficeId: "metro_active_office_id",
} as const;

export const AUTH_HEADER_NAMES = {
  workosSession: "X-Metro-WorkOS-Session",
  refreshedWorkosSession: "X-Metro-WorkOS-Refreshed-Session",
} as const;

function numericEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const WORKOS_SESSION_MAX_AGE_SECONDS = numericEnv(
  process.env.WORKOS_SESSION_MAX_AGE_SECONDS,
  60 * 60 * 24 * 7,
);
export const ACTIVE_CONTEXT_MAX_AGE_SECONDS = WORKOS_SESSION_MAX_AGE_SECONDS;

export function getCookieSecurityOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
}
