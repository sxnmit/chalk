"use client"

import * as React from "react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type CalendarProps = DayPickerProps

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("rdp-root p-3", className)}
      classNames={{
        months: cn("rdp-months"),
        month: cn("rdp-month"),
        month_caption: cn("rdp-month_caption", "flex items-center"),
        caption_label: cn("rdp-caption_label", "text-sm font-semibold tracking-wide"),
        nav: cn("rdp-nav", "gap-1"),
        button_previous: cn(
          "rdp-button_previous",
          "rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        ),
        button_next: cn(
          "rdp-button_next",
          "rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        ),
        month_grid: cn("rdp-month_grid"),
        weekdays: cn("rdp-weekdays"),
        weekday: cn("rdp-weekday", "text-muted-foreground w-9"),
        weeks: cn("rdp-weeks"),
        week: cn("rdp-week"),
        day: cn("rdp-day"),
        day_button: cn(
          "rdp-day_button",
          "hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
        ),
        today: cn("rdp-today"),
        outside: cn("rdp-outside"),
        disabled: cn("rdp-disabled", "cursor-not-allowed"),
        hidden: cn("rdp-hidden"),
        range_start: cn("rdp-range_start"),
        range_end: cn("rdp-range_end"),
        range_middle: cn("rdp-range_middle"),
        selected: cn("rdp-selected"),
        focused: cn("rdp-focused"),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}
