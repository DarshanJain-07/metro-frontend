import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { AppSkeleton } from "@/components/app-skeleton";
import { PwaRegister } from "@/components/pwa-register";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
            <AuthProvider>
              <PwaRegister />
              <AppShell>{children}</AppShell>
              <Toaster />
            </AuthProvider>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
