"use client"

import { Badge } from "@/components/ui/badge"
import type { SubscriptionSummary } from "@/lib/billing/types"

function labelForStatus(status: SubscriptionSummary["status"]) {
  if (status === "none") return "No subscription"
  return status.replaceAll("_", " ")
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled"
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

export function SubscriptionStatus({ subscription }: { subscription: SubscriptionSummary }) {
  const variant =
    subscription.status === "active" || subscription.status === "trialing"
      ? "default"
      : subscription.status === "past_due"
        ? "destructive"
        : "secondary"

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium">Chalk Monthly</h2>
          <p className="text-sm text-muted-foreground">$79 CAD/month per venue</p>
        </div>
        <Badge variant={variant} className="capitalize">
          {labelForStatus(subscription.status)}
        </Badge>
      </div>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">Trial ends</p>
          <p className="font-medium">{formatDate(subscription.trialEndsAt)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Next bill</p>
          <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
        </div>
      </div>
    </div>
  )
}
