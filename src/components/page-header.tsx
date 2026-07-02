"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row md:items-end justify-between gap-3 shrink-0 pb-3 mb-3",
        className,
      )}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 shrink-0">{actions}</div>
      )}
    </div>
  );
}
