"use client";

import { useTheme } from "@/components/theme-provider";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!mounted) return <div className={cn("w-8 h-8 shrink-0", className)} />;

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    if (!document.startViewTransition) {
      setTheme(nextTheme);
      return;
    }
    document.documentElement.classList.add("no-transitions");

    const transition = document.startViewTransition(() => {
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
      setTheme(nextTheme);
    });

    transition.finished.finally(() => {
      setTimeout(() => {
        document.documentElement.classList.remove("no-transitions");
      }, 0);
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 transition-all duration-300 shrink-0", className)}
      onClick={toggleTheme}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
