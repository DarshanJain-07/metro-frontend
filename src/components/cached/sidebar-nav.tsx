import { cacheLife } from "next/cache";
import type { LucideIcon } from "lucide-react";
import { sidebarGroups } from "@/lib/routes";

export default async function CachedSidebarNav() {
  'use cache';
  cacheLife('days');
  
  // In a real app, you might fetch these from a CMS or DB
  // Here we cache the static structure from lib/routes
  
  return (
    <div className="flex flex-col items-center gap-4">
      {sidebarGroups.map((group, idx) => (
        <div key={idx} className="flex flex-col items-center gap-2">
          <div className="flex flex-col gap-1.5">
            {group.items.map((item, itemIdx) => (
              <SidebarIconLink 
                key={itemIdx}
                href={item.href}
                label={item.label}
                Icon={item.icon}
              />
            ))}
          </div>
          {idx < sidebarGroups.length - 1 && (
            <div className="w-6 h-px bg-border/50" />
          )}
        </div>
      ))}
    </div>
  );
}

// Internal component for the structure
// Note: Actual "Active" state is handled by a Client Component wrapper
function SidebarIconLink({ href, label, Icon }: { href: string; label: string; Icon: LucideIcon }) {
  return (
    <div 
      data-href={href}
      title={label}
      className="sidebar-link-placeholder flex items-center justify-center w-9 h-9 text-muted-foreground/60 rounded-md"
    >
      <Icon className="h-4 w-4 shrink-0" />
    </div>
  );
}
