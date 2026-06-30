import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const surfaceVariants = cva("rounded-md border border-border", {
  variants: {
    variant: {
      default: "bg-card shadow-sm",
      muted: "bg-muted/40 shadow-sm",
      elevated: "bg-card shadow-xl shadow-black/5",
      inset: "bg-background shadow-inner",
      primary: "bg-primary text-primary-foreground shadow-sm",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-4 md:p-5",
      lg: "p-6",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "md",
  },
});

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof surfaceVariants>;

function Surface({ className, variant, padding, ...props }: SurfaceProps) {
  return (
    <div
      data-slot="surface"
      className={cn(surfaceVariants({ variant, padding }), className)}
      {...props}
    />
  );
}

interface SectionTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

function SectionTitle({
  children,
  icon,
  action,
  className,
  ...props
}: SectionTitleProps) {
  return (
    <div
      data-slot="section-title"
      className={cn(
        "mb-3 flex items-center gap-2 pb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export { Surface, SectionTitle, surfaceVariants };
