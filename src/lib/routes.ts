import { 
  Plus, 
  List, 
  Inbox,
  Truck,
  ArrowRightLeft, 
  User, 
  Building2, 
  LayoutGrid,
  CreditCard,
  PieChart,
  Search,
  LucideIcon
} from "lucide-react";
import { Permission } from "./auth-context";

export interface SidebarItem {
  icon: LucideIcon;
  label: string;
  href: string;
  permissions: Permission[];
}

export interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

export const sidebarGroups: SidebarGroup[] = [
  {
    title: "DASHBOARD",
    items: [
      { icon: PieChart, label: "Company", href: "/dashboard/company", permissions: ["reports:view"] },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { icon: Plus, label: "New Docket", href: "/dockets/new", permissions: ["shipment:create"] },
      { icon: List, label: "Dockets", href: "/dockets", permissions: ["shipment:view"] },
      { icon: Inbox, label: "Incoming Parcels", href: "/incoming-parcels", permissions: ["shipment:view"] },
      { icon: Truck, label: "Delivery", href: "/delivery", permissions: ["shipment:view"] },
    ],
  },
  {
    title: "MASTERS",
    items: [
      { icon: Building2, label: "Parties", href: "/masters/parties", permissions: ["master:view"] },
      { icon: Search, label: "Discovery", href: "/masters/discovery", permissions: ["shipment:view", "invoice:view", "shipment:receive", "master:view"] },
      { icon: ArrowRightLeft, label: "Branches", href: "/masters/branches", permissions: ["*"] },
      { icon: LayoutGrid, label: "Cities", href: "/masters/cities", permissions: ["*"] },
      { icon: LayoutGrid, label: "States", href: "/masters/states", permissions: ["*"] },
    ],
  },
  {
    title: "ADMIN",
    items: [
      { icon: User, label: "Users & Roles", href: "/admin/users", permissions: ["users:view", "roles:manage"] },
    ],
  },
  {
    title: "ACCOUNTS",
    items: [
      { icon: CreditCard, label: "Customer Billing", href: "/accounts/billing", permissions: ["invoice:view"] },
      { icon: CreditCard, label: "Expense Tracker", href: "/accounts/expenses", permissions: ["expense:view"] },
      { icon: CreditCard, label: "Cashbook", href: "/accounts/cashbook", permissions: ["expense:view"] },
    ],
  },
];

export function getRequiredPermissions(pathname: string): Permission[] | null {
  for (const group of sidebarGroups) {
    for (const item of group.items) {
      if (item.href === pathname) return item.permissions;
    }
  }

  if (pathname.startsWith('/dockets/') && pathname !== '/dockets/new') {
    return ["shipment:view"];
  }

  return null;
}
