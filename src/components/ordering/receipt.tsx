"use client"

import { forwardRef } from "react"
import { formatMoney } from "@/lib/format"
import { Separator } from "@/components/ui/separator"

export interface ReceiptData {
  venueName: string
  receiptFooter?: string
  currency?: string
  receiptNumber: string
  createdAt: string
  tableName: string
  isTab?: boolean
  startedAt: string
  endedAt: string
  durationMinutes: number
  actualRateCharged: number
  orderItems: { name: string; quantity: number; price_at_time_cents: number; line_total_cents: number }[]
  tableTotalCents: number
  itemsTotalCents: number
  taxCents: number
  tipCents?: number
  grandTotalCents: number
  method: "card" | "cash" | "terminal"
  cardLast4?: string | null
  refunds?: { amount_cents: number; reason: string; kind: "refund" | "void" | "comp"; created_at: string }[]
  refundedTotalCents?: number
  netPaidCents?: number
  // Refund-control metadata (used by the receipt page, not rendered on the slip).
  canRefund?: boolean
  paymentStatus?: string
}

const REFUND_KIND_LABEL: Record<"refund" | "void" | "comp", string> = {
  refund: "Refund",
  void: "Void",
  comp: "Comp",
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  })
}

export const Receipt = forwardRef<HTMLDivElement, { data: ReceiptData }>(({ data }, ref) => {
  const cur = data.currency ?? "CAD"
  const fmt = (cents: number) => formatMoney(cents, cur)
  return (
    <div
      ref={ref}
      className="receipt-root mx-auto w-full max-w-[80mm] bg-white text-gray-900 p-4 font-mono text-xs leading-relaxed"
    >
      {/* Header */}
      <div className="text-center mb-3">
        <div className="font-bold text-base">{data.venueName}</div>
        <div className="text-gray-500 text-[10px] mt-0.5">Receipt #{data.receiptNumber}</div>
        <div className="text-gray-500 text-[10px]">{formatDateTime(data.createdAt)}</div>
      </div>

      <Separator className="bg-gray-300 my-2" />

      {/* Session info */}
      <div className="space-y-0.5 mb-2">
        <div className="flex justify-between">
          <span className="text-gray-500">{data.isTab ? "Tab" : "Table"}</span>
          <span className="font-medium">{data.tableName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Start</span>
          <span>{new Date(data.startedAt).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">End</span>
          <span>{new Date(data.endedAt).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
        </div>
        {!data.isTab && (
          <div className="flex justify-between">
            <span className="text-gray-500">Duration</span>
            <span>{formatDuration(data.durationMinutes)}</span>
          </div>
        )}
      </div>

      <Separator className="bg-gray-300 my-2" />

      {/* Table charge */}
      {!data.isTab && (
        <div className="flex justify-between mb-1">
          <span>Table ({fmt(data.actualRateCharged * 100)}/hr × {formatDuration(data.durationMinutes)})</span>
          <span className="font-medium">{fmt(data.tableTotalCents)}</span>
        </div>
      )}

      {/* Order items */}
      {data.orderItems.length > 0 && (
        <>
          <Separator className="bg-gray-200 my-1.5" />
          <div className="space-y-0.5 mb-1">
            {data.orderItems.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span>{item.quantity}× {item.name}</span>
                <span>{fmt(item.line_total_cents)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <Separator className="bg-gray-300 my-2" />

      {/* Totals */}
      <div className="space-y-0.5">
        {data.itemsTotalCents > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Food & drinks</span>
            <span>{fmt(data.itemsTotalCents)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-600">
          <span>Tax</span>
          <span>{fmt(data.taxCents)}</span>
        </div>
        {data.tipCents != null && data.tipCents > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Tip</span>
            <span>{fmt(data.tipCents)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm mt-1">
          <span>TOTAL</span>
          <span>{fmt(data.grandTotalCents)}</span>
        </div>
      </div>

      {/* Refunds / voids / comps */}
      {(data.refundedTotalCents ?? 0) > 0 && (
        <>
          <Separator className="bg-gray-300 my-2" />
          <div className="space-y-0.5">
            {(data.refunds ?? []).map((r, i) => (
              <div key={i} className="flex justify-between text-red-600">
                <span>
                  {REFUND_KIND_LABEL[r.kind]}
                  {r.reason ? ` — ${r.reason}` : ""}
                </span>
                <span>-{fmt(r.amount_cents)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-red-600">
              <span>Refunded</span>
              <span>-{fmt(data.refundedTotalCents ?? 0)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm mt-1">
              <span>NET PAID</span>
              <span>{fmt(data.netPaidCents ?? data.grandTotalCents - (data.refundedTotalCents ?? 0))}</span>
            </div>
          </div>
        </>
      )}

      <Separator className="bg-gray-300 my-2" />

      {/* Payment */}
      <div className="text-gray-600 text-[10px] text-center">
        {data.method === "cash" && "Paid by cash"}
        {data.method === "card" && `Paid by card${data.cardLast4 ? ` •••• ${data.cardLast4}` : ""}`}
        {data.method === "terminal" && "Paid by terminal"}
      </div>

      {/* Footer */}
      {(data.receiptFooter || "Thank you!") && (
        <div className="text-center text-gray-400 text-[10px] mt-3">
          {data.receiptFooter || "Thank you!"}
        </div>
      )}

    </div>
  )
})

Receipt.displayName = "Receipt"
