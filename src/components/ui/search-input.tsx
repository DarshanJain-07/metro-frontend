"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { CompactInput } from "@/components/ui/form-elements";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<React.ComponentProps<typeof CompactInput>, "type"> & {
  wrapperClassName?: string;
};

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, wrapperClassName, style, ...props }, ref) => (
    <div className={cn("relative", wrapperClassName)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <CompactInput
        ref={ref}
        type="text"
        role="searchbox"
        className={cn("pl-10", className)}
        style={{
          ...style,
          paddingInlineStart: "2.5rem",
        }}
        {...props}
      />
    </div>
  ),
);
SearchInput.displayName = "SearchInput";
