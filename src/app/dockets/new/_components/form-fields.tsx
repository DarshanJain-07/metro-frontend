import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import React from "react";

export const FormLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-xs text-muted-foreground font-medium mb-1 block">
    {children}
  </Label>
);

export const StyledInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>((props, ref) => (
  <Input
    ref={ref}
    {...props}
    className={cn(
      "compact-input transition-all duration-300 focus-visible:border-ring focus-visible:ring-0 focus-visible:bg-background",
      props.className
    )}
  />
));
StyledInput.displayName = "StyledInput";

export const StyledSelect = React.forwardRef<
  HTMLSelectElement,
  { name: string; options: string[]; className?: string } & React.SelectHTMLAttributes<HTMLSelectElement>
>(({ name, options, className, ...props }, ref) => (
  <div className={cn("relative", className)}>
    <select
      ref={ref}
      name={name}
      className={cn(
        "w-full h-8 px-2 py-1 text-xs rounded-[var(--radius)] border border-border bg-background text-foreground focus:border-ring focus:ring-0 outline-none appearance-none transition-all duration-300",
        className && className.split(" ").filter((c) => c.startsWith("h-"))
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1 3L4 6L7 3"
          stroke="currentColor"
          className="text-muted-foreground"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  </div>
));
StyledSelect.displayName = "StyledSelect";
