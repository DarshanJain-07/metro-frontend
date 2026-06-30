"use client"

import { useTheme } from "@/components/theme-provider"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-md font-sans tracking-tight",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!bg-emerald-100 group-[.toaster]:!text-emerald-700 group-[.toaster]:!border-emerald-200 dark:group-[.toaster]:!bg-emerald-500/20 dark:group-[.toaster]:!text-emerald-400 dark:group-[.toaster]:!border-emerald-500/30",
          error: "group-[.toaster]:!bg-red-100 group-[.toaster]:!text-red-700 group-[.toaster]:!border-red-200 dark:group-[.toaster]:!bg-red-500/20 dark:group-[.toaster]:!text-red-400 dark:group-[.toaster]:!border-red-500/30",
          warning: "group-[.toaster]:!bg-amber-100 group-[.toaster]:!text-amber-700 group-[.toaster]:!border-amber-200 dark:group-[.toaster]:!bg-amber-500/20 dark:group-[.toaster]:!text-amber-400 dark:group-[.toaster]:!border-amber-500/30",
          info: "group-[.toaster]:!bg-blue-100 group-[.toaster]:!text-blue-700 group-[.toaster]:!border-blue-200 dark:group-[.toaster]:!bg-blue-500/20 dark:group-[.toaster]:!text-blue-400 dark:group-[.toaster]:!border-blue-500/30",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
