import type { DocketFilters } from "@/app/dockets/_lib/actions";
import type { BillingFilters } from "@/app/accounts/billing/_lib/actions";

type SerializableFilters = Record<
  string,
  string | number | boolean | null | undefined
>;

function contextKey(activeMembershipId?: string | null) {
  return activeMembershipId || "no-active-membership";
}

function cleanFilters<T extends SerializableFilters>(filters: T) {
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};

export const masterKeys = {
  all: ["masters"] as const,
  list: (
    activeMembershipId: string | null | undefined,
    apiPath: string,
    filters: SerializableFilters = {},
  ) =>
    [
      ...masterKeys.all,
      "list",
      contextKey(activeMembershipId),
      apiPath,
      cleanFilters(filters),
    ] as const,
  options: (
    activeMembershipId: string | null | undefined,
    optionKey: string,
  ) =>
    [
      ...masterKeys.all,
      "options",
      contextKey(activeMembershipId),
      optionKey,
    ] as const,
  parties: (activeMembershipId: string | null | undefined) =>
    [...masterKeys.all, "parties", contextKey(activeMembershipId)] as const,
};

export const docketKeys = {
  all: ["dockets"] as const,
  lists: () => [...docketKeys.all, "list"] as const,
  list: (
    activeMembershipId: string | null | undefined,
    apiPath: string,
    filters: DocketFilters,
  ) =>
    [
      ...docketKeys.lists(),
      contextKey(activeMembershipId),
      apiPath,
      cleanFilters(filters as SerializableFilters),
    ] as const,
  detail: (activeMembershipId: string | null | undefined, id: string | number) =>
    [...docketKeys.all, "detail", contextKey(activeMembershipId), String(id)] as const,
  metadata: (activeMembershipId: string | null | undefined) =>
    [...docketKeys.all, "metadata", contextKey(activeMembershipId)] as const,
  printMetadata: (activeMembershipId: string | null | undefined) =>
    [...docketKeys.all, "print-metadata", contextKey(activeMembershipId)] as const,
};

export const billingKeys = {
  all: ["billing"] as const,
  list: (
    activeMembershipId: string | null | undefined,
    filters: BillingFilters,
  ) =>
    [
      ...billingKeys.all,
      "list",
      contextKey(activeMembershipId),
      cleanFilters(filters as SerializableFilters),
    ] as const,
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  company: (activeMembershipId: string | null | undefined) =>
    [...dashboardKeys.all, "company", contextKey(activeMembershipId)] as const,
};

export const cashbookKeys = {
  all: ["cashbook"] as const,
  range: (
    activeMembershipId: string | null | undefined,
    from: string,
    to: string,
  ) => [...cashbookKeys.all, contextKey(activeMembershipId), from, to] as const,
};

export const expenseKeys = {
  all: ["expenses"] as const,
  dailySummary: (activeMembershipId: string | null | undefined) =>
    [...expenseKeys.all, "daily-summary", contextKey(activeMembershipId)] as const,
  branchSummary: (
    activeMembershipId: string | null | undefined,
    date: string,
  ) =>
    [...expenseKeys.all, "branch-summary", contextKey(activeMembershipId), date] as const,
  list: (
    activeMembershipId: string | null | undefined,
    date: string,
    office: string | null,
  ) =>
    [
      ...expenseKeys.all,
      "list",
      contextKey(activeMembershipId),
      date,
      office || "no-office",
    ] as const,
};

export const adminKeys = {
  all: ["admin"] as const,
  clients: (activeMembershipId: string | null | undefined) =>
    [...adminKeys.all, "clients", contextKey(activeMembershipId)] as const,
  roles: (activeMembershipId: string | null | undefined) =>
    [...adminKeys.all, "roles", contextKey(activeMembershipId)] as const,
  permissionsCatalog: (activeMembershipId: string | null | undefined) =>
    [
      ...adminKeys.all,
      "permissions-catalog",
      contextKey(activeMembershipId),
    ] as const,
  rolePermissions: (
    activeMembershipId: string | null | undefined,
    role: string | null | undefined,
  ) =>
    [
      ...adminKeys.all,
      "role-permissions",
      contextKey(activeMembershipId),
      role || "no-role",
    ] as const,
};
