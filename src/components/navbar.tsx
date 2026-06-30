"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Menu, UserCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavbarSkeleton } from "@/components/app-skeleton";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { isLoading, activeMembership, logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username
    : "Account";

  if (isLoading) {
    return (
      <header 
        className="sticky top-0 z-50 w-full h-12 px-4 md:px-6 bg-background/90 border-b border-border text-foreground shrink-0 flex items-center"
      >
        <NavbarSkeleton />
      </header>
    );
  }

  return (
    <header 
      className="sticky top-0 z-50 w-full h-12 px-4 md:px-6 bg-background/80 backdrop-blur-md text-foreground shrink-0 transition-colors duration-200 flex items-center shadow-sm border-b border-border"
    >
      <div className="flex items-center gap-4 md:gap-6 h-full">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[80px] p-0 flex flex-col items-center">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Access application sections and settings.
            </SheetDescription>
            <div className="py-4 border-b border-border w-full flex justify-center">
              <span className="font-bold text-xs tracking-tighter">METRO</span>
            </div>
            <SidebarContent onItemClick={() => setIsOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link href="/dockets" className="hidden sm:flex md:hidden items-center group">
          <span className="font-bold text-sm tracking-tighter">Metro</span>
        </Link>
        {activeMembership && (
          <div className="hidden md:flex items-center gap-4">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold tracking-tight">{activeMembership.company_name}</span>
            {activeMembership.branch_name && (
              <>
                <span className="w-px h-4 bg-border" />
                <span className="text-sm font-medium text-muted-foreground">{activeMembership.branch_name}</span>
              </>
            )}
            <span className="w-px h-4 bg-border" />
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">{activeMembership.role.replace('_', ' ').toLowerCase()}</span>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-4 md:gap-6">
        <ThemeToggle />
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <UserCircle className="h-4 w-4" />
                <span className="hidden sm:inline max-w-40 truncate">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="grid gap-1">
                  <span className="font-medium text-foreground">{displayName}</span>
                  {user.email ? (
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  ) : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  void logout();
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
