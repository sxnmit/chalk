"use client"

import { useEffect, useState } from "react"
import type { SubscriptionSummary } from "@/lib/billing/types"
import { BillingPortalButton } from "@/components/billing/billing-portal-button"

function daysLeft(date: string | null) {
  if (!date) return null
  return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
}

export function TrialBanner() {
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null)

  useEffect(() => {
    fetch("/api/billing/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setSubscription(data?.subscription ?? null))
      .catch(() => setSubscription(null))
  }, [])

  if (subscription?.status !== "trialing") return null

  const left = daysLeft(subscription.trialEndsAt)
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 rounded-lg border border-primary/30 bg-background/95 p-3 shadow-lg backdrop-blur sm:left-auto sm:w-[420px]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          Trial active{left === null ? "" : `: ${left} day${left === 1 ? "" : "s"} left`}
        </p>
        <BillingPortalButton />
      </div>
    </div>
  )
}
