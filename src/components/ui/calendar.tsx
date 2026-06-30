"use client"

import * as React from "react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar bg-background p-3 rounded-md border border-border shadow-sm",
        className
      )}
      captionLayout={captionLayout}
      startMonth={new Date(2000, 0)}
      endMonth={new Date(2100, 11)}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 sm:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1 px-1 z-10",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-8 w-full items-center justify-center",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex items-center justify-center gap-1 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative rounded-md hover:bg-accent transition-colors",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 bg-transparent opacity-0 cursor-pointer z-20",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium select-none",
          defaultClassNames.caption_label
        ),
        weekdays: cn("flex w-full", defaultClassNames.weekdays),
        weekday: cn(
          "w-8 text-center text-[0.8rem] font-normal text-muted-foreground select-none",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        day: cn(
          "relative h-8 w-8 p-0 text-center text-sm focus-within:relative focus-within:z-20",
          defaultClassNames.day
        ),
        today: cn(
          "rounded-md bg-accent text-accent-foreground",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground/50 opacity-50",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground/50 opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className="size-4" />
          }
          if (orientation === "right") {
            return <ChevronRightIcon className="size-4" />
          }
          return <ChevronDownIcon className="size-4" />
        },
        DayButton: (props) => (
          <CalendarDayButton {...props} />
        ),
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "h-8 w-8 p-0 font-normal transition-none hover:bg-accent hover:text-accent-foreground active:scale-100",
        modifiers.selected &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground opacity-100",
        modifiers.range_start && "rounded-md",
        modifiers.range_end && "rounded-md",
        modifiers.range_middle &&
          "bg-muted text-foreground rounded-none hover:bg-muted hover:text-foreground",
        modifiers.outside &&
          "text-muted-foreground/50 opacity-50 pointer-events-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
        className
      )}
      {...props}
    />
  )
}


export { Calendar, CalendarDayButton }
