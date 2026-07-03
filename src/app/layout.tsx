import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { dehydrate } from "@tanstack/react-query";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { AppSkeleton } from "@/components/app-skeleton";
import { PwaRegister } from "@/components/pwa-register";
import { AuthProvider } from "@/lib/auth-context";
import { authKeys } from "@/lib/query-keys";
import { makeQueryClient } from "@/lib/query-client";
import { QueryProvider } from "@/lib/query-provider";
import { getServerAuthSession, hasAuthCookies } from "@/lib/server-auth";

const inter = localFont({
  src: [
    {
      path: "./fonts/inter/Inter-VariableFont_opsz-wght.ttf",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "./fonts/inter/Inter-Italic-VariableFont_opsz-wght.ttf",
      style: "italic",
      weight: "100 900",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Metro Logistics",
  description: "Logistics management system",
  applicationName: "Metro Logistics",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Metro Logistics",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

async function HydratedApp({ children }: { children: React.ReactNode }) {
  const queryClient = makeQueryClient();

  if (await hasAuthCookies()) {
    await queryClient
      .prefetchQuery({
        queryKey: authKeys.session(),
        queryFn: getServerAuthSession,
      })
      .catch(() => undefined);
  }

  return (
    <QueryProvider dehydratedState={dehydrate(queryClient)}>
      <AuthProvider>
        <PwaRegister />
        <AppShell>{children}</AppShell>
        <Toaster />
      </AuthProvider>
    </QueryProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", inter.variable, "font-sans")}
    >
      <body className="h-screen overflow-hidden flex flex-col tracking-tight antialiased text-sm">
        <ThemeProvider defaultTheme="system">
          <Suspense fallback={<AppSkeleton />}>
            <HydratedApp>{children}</HydratedApp>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
