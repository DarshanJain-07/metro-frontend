"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: string // dd/mm/yyyy
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", className, disabled }: DatePickerProps) {
  const date = React.useMemo(() => {
    if (!value) return undefined
    try {
      const parsed = parse(value, "dd/MM/yyyy", new Date())
      return isNaN(parsed.getTime()) ? undefined : parsed
    } catch {
      return undefined
    }
  }, [value])

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant={"outline"}
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-between px-3 text-left text-sm font-normal",
              !value && "text-muted-foreground",
              className
            )}
          >
            {value ? value : <span>{placeholder}</span>}
            <CalendarIcon className="ml-2 h-3.5 w-3.5 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            if (selectedDate) {
              onChange?.(format(selectedDate, "dd/MM/yyyy"))
            } else {
              onChange?.("")
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
