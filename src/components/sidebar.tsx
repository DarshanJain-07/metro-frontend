"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Plus, 
  List, 
  FileText, 
  Calculator, 
  UserPlus, 
  ArrowRightLeft, 
  User, 
  Building2, 
  LayoutGrid
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const sidebarGroups = [
  {
    title: "OPERATIONS",
    items: [
      { icon: Plus, label: "New", href: "/dockets/new" },
      { icon: List, label: "List", href: "/dockets" },
    ],
  },
  {
    title: "MASTERS",
    items: [
      { icon: LayoutGrid, label: "States", href: "/masters/states" },
      { icon: Building2, label: "Cities", href: "/masters/cities" },
      { icon: ArrowRightLeft, label: "Branches", href: "/masters/branches" },
      { icon: UserPlus, label: "Parties", href: "/masters/parties" },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { icon: FileText, label: "Ledger", href: "/account/ledger" },
      { icon: Calculator, label: "Bills", href: "/account/bills" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[var(--app-sidebar-width)] bg-background border-r border-border flex-col items-center py-4 shrink-0 overflow-y-auto no-scrollbar transition-colors duration-300">
      <div className="flex-1 w-full">
        {sidebarGroups.map((group, idx) => (
          <div key={idx} className="w-full mb-6 flex flex-col items-center">
            <span className="text-[8px] font-black text-muted-foreground mb-4 px-1 text-center leading-tight">
              {group.title}
            </span>
            <div className="flex flex-col gap-5">
              {group.items.map((item, itemIdx) => (
                <Link
                  key={itemIdx}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center transition-colors group",
                    pathname === item.href ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 mb-1 stroke-[1.5]" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="pt-4 border-t border-border w-full flex justify-center">
        <ThemeToggle className="hover:bg-muted" />
      </div>
    </aside>
  );
}
