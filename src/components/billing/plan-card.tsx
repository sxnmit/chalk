"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PlanCard({ onContinue }: { onContinue?: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-medium">Chalk Monthly</h2>
          <p className="mt-1 text-sm text-muted-foreground">One venue, unlimited tables, all features.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">$79</p>
          <p className="text-xs text-muted-foreground">CAD/month</p>
        </div>
      </div>
      <ul className="mt-5 space-y-2 text-sm">
        {["14-day free trial", "No credit card required to start", "Team roles and billing controls"].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            {item}
          </li>
        ))}
      </ul>
      {onContinue && (
        <Button className="mt-5 w-full" onClick={onContinue}>
          Start free trial
        </Button>
      )}
    </div>
  )
}
