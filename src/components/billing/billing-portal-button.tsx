"use client"

import { useState } from "react"
import { CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"

export function BillingPortalButton({ disabled = false }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openPortal() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Unable to open billing portal")
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing portal")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={openPortal} disabled={disabled || loading}>
        <CreditCard />
        {loading ? "Opening..." : "Manage billing"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
