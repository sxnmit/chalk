"use client"

import type { ReactNode } from "react"
import { Banknote, CreditCard, Radio } from "lucide-react"
import { cn } from "@/lib/utils"

interface PaymentMethodPickerProps {
  value?: "card" | "cash" | "tap"
  onChange?: (value: "card" | "cash" | "tap") => void
  terminalSlot?: ReactNode
  className?: string
}

const methods = [
  { value: "card" as const, label: "Card", icon: CreditCard },
  { value: "cash" as const, label: "Cash", icon: Banknote },
  { value: "tap" as const, label: "Tap to pay", icon: Radio },
]

/** Example: <PaymentMethodPicker value="cash" terminalSlot={<Terminal />} /> */
export function PaymentMethodPicker({ value, onChange, terminalSlot, className }: PaymentMethodPickerProps) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {methods.map((method) => {
        const Icon = method.icon
        const disabled = method.value === "tap" && !terminalSlot
        return (
          <button
            key={method.value}
            type="button"
            disabled={disabled}
            title={disabled ? "Hardware not configured" : undefined}
            onClick={() => onChange?.(method.value)}
            className={cn(
              "flex min-h-16 items-center gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 text-left text-sm font-medium text-text transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50",
              value === method.value && "border-chalk bg-chalk-soft text-chalk"
            )}
          >
            <Icon className="h-4 w-4" />
            {method.label}
          </button>
        )
      })}
      {terminalSlot}
    </div>
  )
}
