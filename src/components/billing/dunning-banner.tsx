"use client"

import { useEffect, useState } from "react"
import type { SubscriptionSummary } from "@/lib/billing/types"
import { BillingPortalButton } from "@/components/billing/billing-portal-button"

export function DunningBanner() {
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null)

  useEffect(() => {
    fetch("/api/billing/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setSubscription(data?.subscription ?? null))
      .catch(() => setSubscription(null))
  }, [])

  if (subscription?.status !== "past_due") return null

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 rounded-lg border border-destructive/40 bg-background/95 p-3 shadow-lg backdrop-blur sm:left-auto sm:w-[440px]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-destructive">Payment failed. Update billing to keep access active.</p>
        <BillingPortalButton />
      </div>
    </div>
  )
}
