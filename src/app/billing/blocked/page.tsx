"use client"

import Link from "next/link"
import { BillingPortalButton } from "@/components/billing/billing-portal-button"
import { Button } from "@/components/ui/button"

export default function BillingBlockedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <h1 className="font-heading text-2xl font-medium">Subscription needed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This venue needs an active subscription before the app can be used.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <BillingPortalButton />
          <Button asChild variant="outline">
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
