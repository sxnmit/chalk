"use client"

import { cn } from "@/lib/utils"

interface TabOption {
  value: string
  label: string
}

interface TabBarProps {
  options: TabOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/** Example: <TabBar options={tabs} value={tab} onChange={setTab} /> */
export function TabBar({ options, value, onChange, className }: TabBarProps) {
  return (
    <div className={cn("inline-flex rounded-[var(--radius)] border border-border bg-surface-2 p-1", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "h-9 rounded-[calc(var(--radius)-2px)] px-3 text-sm font-medium text-text-muted transition-colors",
            value === option.value && "bg-surface text-text shadow-sm"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
