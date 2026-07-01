"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { CreditCard, Banknote, Nfc, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { CartTotals } from "@/components/ordering/cart-totals"
import { StripePaymentForm } from "@/components/ordering/stripe-payment-form"
import { CashConfirmDialog } from "@/components/ordering/cash-confirm-dialog"
import { formatCAD } from "@/lib/format"

type Method = "card" | "cash" | null

interface Totals {
  table_total_cents: number
  items_total_cents: number
  tax_cents: number
  grand_total_cents: number
}

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = params.id as string

  const [method, setMethod] = useState<Method>(null)
  const [totals, setTotals] = useState<Totals | null>(null)
  const [totalsLoading, setTotalsLoading] = useState(true)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [intentLoading, setIntentLoading] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const [cashPaymentId, setCashPaymentId] = useState<string | null>(null)
  const [stripeError, setStripeError] = useState<string | null>(null)

  const loadTotals = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/totals`)
      if (!res.ok) throw new Error()
      setTotals(await res.json())
    } catch {
      toast.error("Failed to load totals")
    } finally {
      setTotalsLoading(false)
    }
  }, [sessionId])

  // Handle Stripe redirect return
  useEffect(() => {
    const piId = searchParams.get("payment_intent")
    if (piId) {
      confirmCard(piId)
    }
  }, [])

  useEffect(() => { loadTotals() }, [loadTotals])

  async function confirmCard(piId: string) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/checkout/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "card", payment_intent_id: piId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/session/${sessionId}/receipt?payment_id=${data.payment_id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment confirmation failed")
    }
  }

  async function selectCard() {
    setMethod("card")
    setIntentLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/checkout/intent`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientSecret(data.client_secret)
      setPaymentId(data.payment_id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout")
      setMethod(null)
    } finally {
      setIntentLoading(false)
    }
  }

  async function handleCashConfirm(amountReceivedCents: number) {
    const res = await fetch(`/api/sessions/${sessionId}/checkout/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "cash" }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? "Cash payment failed")
      throw new Error(data.error)
    }
    setCashPaymentId(data.payment_id)
  }

  function handleCashDialogClose(open: boolean) {
    if (!open && cashPaymentId) {
      router.push(`/session/${sessionId}/receipt?payment_id=${cashPaymentId}`)
      return
    }
    setCashOpen(open)
  }

  const returnUrl = typeof window !== "undefined"
    ? `${window.location.origin}/session/${sessionId}/checkout`
    : `/session/${sessionId}/checkout`

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/session/${sessionId}`)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground font-[family-name:var(--font-exo2)]">Checkout</h1>
        </div>

        {/* Totals */}
        <div className="rounded-xl border border-border/50 bg-card p-4">
          {totalsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Separator />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : totals ? (
            <CartTotals
              tableTotalCents={totals.table_total_cents}
              itemsTotalCents={totals.items_total_cents}
              taxCents={totals.tax_cents}
              grandTotalCents={totals.grand_total_cents}
            />
          ) : null}
        </div>

        {/* Payment method picker */}
        {!method && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium">Payment method</p>
            <div className="grid gap-3">
              <button
                onClick={selectCard}
                className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 text-left hover:border-primary/50 transition-all min-h-[64px] active:scale-[0.99]"
                aria-label="Pay by card"
              >
                <CreditCard className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Card</p>
                  <p className="text-xs text-muted-foreground">Online payment via Stripe</p>
                </div>
              </button>

              <button
                onClick={() => setMethod("cash")}
                className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 text-left hover:border-primary/50 transition-all min-h-[64px] active:scale-[0.99]"
                aria-label="Pay by cash"
              >
                <Banknote className="h-6 w-6 text-success" />
                <div>
                  <p className="font-medium text-foreground">Cash</p>
                  <p className="text-xs text-muted-foreground">Record cash payment</p>
                </div>
              </button>

              {/* Terminal slot — disabled, wired by Agent C */}
              <button
                disabled
                className="flex items-center gap-4 rounded-xl border border-border/30 bg-card/50 p-4 text-left opacity-40 cursor-not-allowed min-h-[64px]"
                aria-label="Tap to pay — coming soon"
              >
                <Nfc className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Tap to Pay</p>
                  <p className="text-xs text-muted-foreground">Terminal reader — coming soon</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Card flow */}
        {method === "card" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Card payment
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setMethod(null); setClientSecret(null) }}>
                Change
              </Button>
            </div>
            {intentLoading && <Skeleton className="h-40 rounded-xl" />}
            {stripeError && (
              <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 p-3">{stripeError}</p>
            )}
            {clientSecret && totals && !intentLoading && (
              <StripePaymentForm
                clientSecret={clientSecret}
                grandTotalCents={totals.grand_total_cents}
                returnUrl={returnUrl}
                onError={setStripeError}
              />
            )}
          </div>
        )}

        {/* Cash CTA */}
        {method === "cash" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Banknote className="h-4 w-4 text-success" /> Cash payment
              </p>
              <Button variant="ghost" size="sm" onClick={() => setMethod(null)}>Change</Button>
            </div>
            <Button className="w-full min-h-[52px] text-base" size="lg" onClick={() => setCashOpen(true)}>
              Mark Cash Received
            </Button>
          </div>
        )}
      </div>

      {/* Cash confirm dialog */}
      {totals && (
        <CashConfirmDialog
          open={cashOpen}
          onOpenChange={handleCashDialogClose}
          grandTotalCents={totals.grand_total_cents}
          onConfirm={handleCashConfirm}
        />
      )}
    </div>
  )
}
