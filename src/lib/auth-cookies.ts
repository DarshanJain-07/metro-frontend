export const AUTH_COOKIE_NAMES = {
  accessToken: "metro_access_token",
  refreshToken: "metro_refresh_token",
  activeMembershipId: "metro_active_membership_id",
  activeCompanyId: "metro_active_company_id",
  activeOfficeId: "metro_active_office_id",
} as const;

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const ACTIVE_CONTEXT_MAX_AGE_SECONDS = REFRESH_TOKEN_MAX_AGE_SECONDS;

export function getCookieSecurityOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
}
