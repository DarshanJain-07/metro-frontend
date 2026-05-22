"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
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
            "group toast group-[.toaster]:bg-foreground group-[.toaster]:text-background group-[.toaster]:border-foreground group-[.toaster]:shadow-lg group-[.toaster]:rounded-md font-sans tracking-tight",
          description: "group-[.toast]:text-background/80",
          actionButton:
            "group-[.toast]:bg-background group-[.toast]:text-foreground group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-foreground/10 group-[.toast]:text-background",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
