"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

export type PasswordInputProps = React.ComponentProps<typeof InputGroupInput>;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <InputGroup className={cn("group/password-input", className)}>
        <InputGroupInput
          {...props}
          ref={ref}
          type={showPassword ? "text" : "password"}
          className="pr-10"
        />
        <InputGroupButton
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-1.5 h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => setShowPassword((prev) => !prev)}
          title={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </InputGroupButton>
      </InputGroup>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
