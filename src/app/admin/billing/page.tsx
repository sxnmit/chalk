"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BillingPortalButton } from "@/components/billing/billing-portal-button"
import { SubscriptionStatus } from "@/components/billing/subscription-status"
import { Button } from "@/components/ui/button"
import type { SubscriptionSummary, VenueRole } from "@/lib/billing/types"

export default function AdminBillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null)
  const [role, setRole] = useState<VenueRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/billing/subscription")
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? "Unable to load billing")
        setSubscription(data.subscription)
        setRole(data.role)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load billing"))
  }, [])

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Button asChild variant="ghost" className="mb-6">
          <Link href="/dashboard">
            <ArrowLeft />
            Dashboard
          </Link>
        </Button>
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-medium">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the subscription for this venue.</p>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !subscription ? (
          <div className="h-40 rounded-lg bg-muted animate-pulse" />
        ) : (
          <div className="space-y-5">
            <SubscriptionStatus subscription={subscription} />
            <div className="rounded-lg border border-border bg-card p-5">
              {role === "owner" ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Use the Customer Portal to add a payment method, update billing details, or cancel.</p>
                  <BillingPortalButton disabled={!subscription.stripeCustomerId} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ask an owner to update billing for this venue.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
