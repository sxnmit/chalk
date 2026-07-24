"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCAD } from "@/lib/format"

type RefundKind = "refund" | "void" | "comp"

interface RefundDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  paymentId: string
  /** Remaining refundable balance in cents (grand total − already refunded). */
  remainingCents: number
  /** Called after a successful refund so the caller can refresh the receipt. */
  onRefunded: () => void
}

const KINDS: { value: RefundKind; label: string; hint: string }[] = [
  { value: "refund", label: "Refund", hint: "Return part or all of the sale" },
  { value: "void", label: "Void", hint: "Reverse the entire sale" },
  { value: "comp", label: "Comp", hint: "Manager comp / zero-out" },
]

export function RefundDialog({
  open,
  onOpenChange,
  sessionId,
  paymentId,
  remainingCents,
  onRefunded,
}: RefundDialogProps) {
  const [kind, setKind] = useState<RefundKind>("refund")
  const [amountStr, setAmountStr] = useState((remainingCents / 100).toFixed(2))
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A void always reverses the full remaining balance; force the amount.
  const isVoid = kind === "void"
  const amountCents = isVoid ? remainingCents : Math.round(parseFloat(amountStr) * 100)

  useEffect(() => {
    if (open) {
      setKind("refund")
      setAmountStr((remainingCents / 100).toFixed(2))
      setReason("")
      setError(null)
    }
  }, [open, remainingCents])

  useEffect(() => {
    if (isVoid) setAmountStr((remainingCents / 100).toFixed(2))
  }, [isVoid, remainingCents])

  const amountValid =
    !isNaN(amountCents) && amountCents >= 1 && amountCents <= remainingCents
  const canSubmit = amountValid && reason.trim().length > 0 && !loading

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          amount_cents: amountCents,
          reason: reason.trim(),
          kind,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Refund failed")
        return
      }
      onRefunded()
      onOpenChange(false)
    } catch {
      setError("Refund failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Refund / Void</DialogTitle>
          <DialogDescription>
            Refundable balance: <span className="font-semibold text-foreground">{formatCAD(remainingCents)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Kind picker */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  title={k.hint}
                  className={
                    "rounded-lg border px-2 py-2 text-sm font-medium transition-colors " +
                    (kind === k.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/50 bg-secondary/40 text-muted-foreground hover:border-primary/40")
                  }
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="refund-amount"
                className="pl-7 text-lg font-semibold"
                value={(amountCents / 100).toFixed(2)}
                onChange={(e) => setAmountStr(e.target.value)}
                type="number"
                min="0.01"
                max={(remainingCents / 100).toFixed(2)}
                step="0.01"
                disabled={isVoid}
              />
            </div>
            {isVoid && (
              <p className="text-xs text-muted-foreground">A void reverses the full remaining balance.</p>
            )}
          </div>

          {/* Reason (required) */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason (required)</Label>
            <Input
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. mis-ring, walkout, comped drink"
              maxLength={500}
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" size="lg" disabled={!canSubmit} onClick={handleSubmit}>
            {loading
              ? "Processing…"
              : `${isVoid ? "Void" : kind === "comp" ? "Comp" : "Refund"} ${formatCAD(amountCents || 0)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
