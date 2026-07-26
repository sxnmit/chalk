"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

type RefundKind = "refund" | "void" | "comp"

interface RefundDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  paymentId: string
  /** Remaining refundable balance in cents (grand total − already refunded). */
  remainingCents: number
  /** Venue currency (e.g. "CAD", "USD") — matches the receipt this produces. */
  currency?: string
  /** Called after a successful refund so the caller can refresh the receipt. */
  onRefunded: () => void
}

const KINDS: { value: RefundKind; label: string; verb: string; hint: string }[] = [
  { value: "refund", label: "Refund", verb: "Refund", hint: "Return part or all of the sale" },
  { value: "void", label: "Void", verb: "Void", hint: "Reverse the entire sale" },
  { value: "comp", label: "Comp", verb: "Comp", hint: "Manager comp / zero-out" },
]

export function RefundDialog({
  open,
  onOpenChange,
  sessionId,
  paymentId,
  remainingCents,
  currency = "CAD",
  onRefunded,
}: RefundDialogProps) {
  const [kind, setKind] = useState<RefundKind>("refund")
  // `amountStr` is the raw edit buffer — bound directly to the input so
  // multi-digit and decimal entry ("12.50") work. amountCents is derived from
  // it for validation and the submit label.
  const [amountStr, setAmountStr] = useState((remainingCents / 100).toFixed(2))
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const fmt = (cents: number) => formatMoney(cents, currency)
  const activeKind = KINDS.find((k) => k.value === kind) ?? KINDS[0]

  // A void always reverses the full remaining balance; force the amount.
  const isVoid = kind === "void"
  const amountCents = isVoid ? remainingCents : Math.round(parseFloat(amountStr) * 100)
  const amountEntered = !isNaN(amountCents)
  const exceedsBalance = amountEntered && amountCents > remainingCents

  useEffect(() => {
    if (open) {
      setKind("refund")
      setAmountStr((remainingCents / 100).toFixed(2))
      setReason("")
    }
  }, [open, remainingCents])

  const amountValid = amountEntered && amountCents >= 1 && amountCents <= remainingCents
  const canSubmit = amountValid && reason.trim().length > 0 && !loading

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
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
        toast.error(typeof data.error === "string" ? data.error : "Refund failed")
        return
      }
      toast.success(`${activeKind.verb} of ${fmt(amountCents)} processed`)
      onRefunded()
      onOpenChange(false)
    } catch {
      toast.error("Refund failed")
    } finally {
      setLoading(false)
    }
  }

  // What the input shows: void is forced to the full balance; otherwise the
  // raw buffer (which may be empty mid-edit — never render "NaN").
  const amountInputValue = isVoid ? (remainingCents / 100).toFixed(2) : amountStr

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Refund / Void</DialogTitle>
          <DialogDescription>
            Refundable balance: <span className="font-semibold text-foreground">{fmt(remainingCents)}</span>
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
                  aria-pressed={kind === k.value}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                    kind === k.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/50 bg-secondary/40 text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
            {/* Visible helper (POS tablets have no hover tooltips). */}
            <p className="text-xs text-muted-foreground">{activeKind.hint}</p>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="refund-amount"
                className="pl-7 text-lg font-semibold"
                value={amountInputValue}
                onChange={(e) => setAmountStr(e.target.value)}
                type="text"
                inputMode="decimal"
                disabled={isVoid}
              />
            </div>
            {isVoid ? (
              <p className="text-xs text-muted-foreground">A void reverses the full remaining balance.</p>
            ) : exceedsBalance ? (
              <p className="text-xs text-destructive">Exceeds refundable balance ({fmt(remainingCents)}).</p>
            ) : null}
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

          <Button className="w-full" size="lg" disabled={!canSubmit} onClick={handleSubmit}>
            {loading ? "Processing…" : `${activeKind.verb} ${fmt(amountEntered ? amountCents : 0)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
