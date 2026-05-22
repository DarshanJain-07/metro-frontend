"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/" || pathname === "/login";

  if (isLoginPage) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {children}
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-0 flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="min-h-0 flex-1 bg-[#373739] dark:bg-zinc-950/50 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  );
}
