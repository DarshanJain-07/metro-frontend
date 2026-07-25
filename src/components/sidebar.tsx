"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { sidebarGroups } from "@/lib/routes";
import { SidebarSkeleton } from "@/components/app-skeleton";

export function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const { can, user } = useAuth();

  const filteredGroups = sidebarGroups.map(group => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.ownerOnly) return !!user?.is_owner;
      return item.permissions.some((permission) => can(permission));
    })
  })).filter(group => group.items.length > 0);

  const allItems = filteredGroups.flatMap(g => g.items);

  return (
    <div className="flex-1 py-4 flex flex-col items-center gap-4 overflow-y-auto">
      {filteredGroups.map((group, idx) => (
        <div key={idx} className="flex flex-col items-center gap-2">
          <div className="flex flex-col gap-1.5">
            {group.items.map((item, itemIdx) => {
              const isActive = pathname === item.href || (
                pathname.startsWith(item.href + '/') && 
                !allItems.some(i => i.href !== item.href && pathname.startsWith(i.href))
              );
              return (
                <Link
                  key={itemIdx}
                  href={item.href}
                  title={labelOverrides[item.label] || item.label}
                  onClick={onItemClick}
                  className={cn(
                    "flex items-center justify-center w-9 h-9 transition-all duration-200 group relative rounded-md",
                    isActive 
                      ? "text-primary bg-accent" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className={cn(
                    "h-4 w-4 shrink-0 transition-colors", 
                    isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground"
                  )} />
                  {isActive && (
                    <div className="absolute left-0 w-0.5 h-4 bg-primary rounded-r-full" />
                  )}
                </Link>
              );
            })}
          </div>
          {idx < filteredGroups.length - 1 && (
            <div className="w-6 h-px bg-border/50" />
          )}
        </div>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <aside
        className="hidden md:flex h-full w-16 bg-background flex-col shrink-0 relative z-20 border-r border-border"
      >
        <SidebarSkeleton />
      </aside>
    );
  }

  return (
    <aside
      className="hidden md:flex h-full w-16 bg-background flex-col shrink-0 relative z-20 border-r border-border"
    >
      <SidebarContent />
    </aside>
  );
}

const labelOverrides: Record<string, string> = {
  "Users & Roles": "Team Management",
  "Expense Tracker": "Expenses",
};
