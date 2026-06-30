"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const FormLabel = ({ children, className, ...props }: React.ComponentPropsWithoutRef<typeof Label>) => (
  <Label 
    className={cn("text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block", className)}
    {...props}
  >
    {children}
  </Label>
);

export const CompactInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>((props, ref) => (
  <Input
    ref={ref}
    {...props}
    className={cn(
      "h-9 text-sm", 
      props.className
    )}
  />
));
CompactInput.displayName = "CompactInput";

export const CompactTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<typeof Textarea>
>((props, ref) => (
  <Textarea
    ref={ref}
    {...props}
    className={cn(
      "text-sm min-h-[80px]", 
      props.className
    )}
  />
));
CompactTextarea.displayName = "CompactTextarea";

export type CompactSelectOption = {
  label: string;
  value: string | number;
};

export interface CompactSelectProps {
  value?: string | number;
  onValueChange?: (value: string) => void;
  options?: CompactSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  id?: string;
}

type OptionElementProps = {
  children: React.ReactNode;
  value: string | number;
};

export const CompactSelect = ({ 
  options = [], 
  onValueChange, 
  value,
  placeholder = "Select...",
  className, 
  children,
  disabled,
  id,
}: CompactSelectProps) => {
  // Support both options prop and children (as native <option> tags)
  const optionsFromChildren = React.Children.map(children, (child) => {
    const childType = React.isValidElement(child) ? child.type as { displayName?: string } | string : null;
    const isOptionElement =
      childType === "option" ||
      (typeof childType === "object" && childType?.displayName === "option");
    if (React.isValidElement<OptionElementProps>(child) && isOptionElement) {
      return {
        label: String(child.props.children),
        value: child.props.value,
      };
    }
    return null;
  })?.filter(Boolean) as CompactSelectOption[] | undefined;

  const allOptions = (options.length > 0 ? options : (optionsFromChildren || []))
    .filter(opt => opt.value !== "" && opt.value !== null && opt.value !== undefined);
  
  const selectedOption = allOptions.find(opt => String(opt.value) === String(value));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full h-9 px-3 justify-between bg-input-background font-medium shadow-none hover:bg-input-background",
            className
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : (value ? String(value) : placeholder)}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="min-w-0"
        align="start"
      >
        <div className="max-h-[200px] overflow-y-auto">
          {placeholder && (
            <DropdownMenuItem
              onSelect={() => onValueChange?.("")}
              className={cn(
                !value && "bg-accent font-medium"
              )}
            >
              <span className="opacity-50">{placeholder}</span>
              {!value && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuItem>
          )}
          {allOptions.map((option) => (
            <DropdownMenuItem
              key={String(option.value)}
              onSelect={() => {
                onValueChange?.(String(option.value));
              }}
              className={cn(
                String(value) === String(option.value) && "bg-accent font-medium"
              )}
            >
              <span className="truncate">{option.label}</span>
              {String(value) === String(option.value) && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
CompactSelect.displayName = "CompactSelect";

export const FormGroup = ({ label, children, className, error }: { label?: React.ReactNode; children: React.ReactNode; className?: string; error?: string }) => (
  <div className={cn("grid gap-1.5", className)}>
    {label && <FormLabel>{label}</FormLabel>}
    {children}
    {error && <p className="text-[10px] text-destructive font-medium uppercase tracking-wider mt-1">{error}</p>}
  </div>
);
