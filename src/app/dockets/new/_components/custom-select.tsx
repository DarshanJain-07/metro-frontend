"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormContext } from "react-hook-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface CustomSelectProps {
  name: string;
  options: Array<string | { label: string; value: string }>;
  placeholder?: string;
  className?: string;
  onValueChange?: (value: string) => void;
}

export function CustomSelect({ name, options, placeholder, className, onValueChange }: CustomSelectProps) {
  const { setValue, watch } = useFormContext();
  const currentValue = watch(name);
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option
  );
  const selectedOption = normalizedOptions.find((option) => option.value === currentValue);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "w-full h-8 px-2 py-1 text-xs justify-between font-normal bg-background border-border hover:bg-background hover:text-foreground focus-visible:border-ring focus-visible:ring-0 aria-expanded:bg-background aria-expanded:text-foreground transition-all duration-300 shadow-none rounded-[var(--radius)]",
            className
          )}
        >
          <span className="truncate">{selectedOption?.label || currentValue || placeholder || "Select..."}</span>
          <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-0 max-w-[var(--radix-dropdown-menu-trigger-width)] p-1 bg-popover text-popover-foreground border border-border rounded-[var(--radius)] shadow-md animate-in fade-in-0 zoom-in-95"
        align="start"
      >
        <div className="max-h-[200px] overflow-y-auto no-scrollbar">
          {normalizedOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => {
                setValue(name, option.value, { shouldValidate: true, shouldDirty: true });
                onValueChange?.(option.value);
              }}
              className={cn(
                "flex items-center justify-between px-2 py-1.5 text-xs cursor-pointer rounded-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                currentValue === option.value && "bg-accent/50 font-medium"
              )}
            >
              <span>{option.label}</span>
              {currentValue === option.value && <Check className="h-3 w-3 text-primary" />}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
