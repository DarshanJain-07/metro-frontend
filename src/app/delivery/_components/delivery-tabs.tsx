"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const deliveryTabs = [
  { label: "Pending", href: "/delivery" },
  { label: "Out for Delivery", href: "/delivery/out-for-delivery" },
  { label: "Completed", href: "/delivery/completed" },
];

export function DeliveryTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 border-b border-border">
      {deliveryTabs.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "h-9 px-3 inline-flex items-center border-b-2 text-sm font-semibold transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
