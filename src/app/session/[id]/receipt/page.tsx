"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Printer, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Receipt, type ReceiptData } from "@/components/ordering/receipt"
import { createClient } from "@/utils/supabase/client"

export default function ReceiptPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = params.id as string
  const paymentId = searchParams.get("payment_id")

  const [data, setData] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      if (!paymentId) { setLoading(false); return }
      try {
        const supabase = createClient()
        const [{ data: payment }, { data: session }] = await Promise.all([
          supabase.from("payments").select("*").eq("id", paymentId).single(),
          supabase.from("sessions").select("*, tables(name), venues(name), rates(label)").eq("id", sessionId).single(),
        ])
        if (!payment || !session) throw new Error("Not found")

        const { data: orderItems } = await supabase
          .from("order_items")
          .select("*, menu_items(name)")
          .eq("session_id", sessionId)

        let cardLast4: string | null = null
        if (payment.stripe_payment_intent_id && payment.method === "card") {
          try {
            const res = await fetch(`/api/sessions/${sessionId}/receipt-data?pi=${payment.stripe_payment_intent_id}`)
            if (res.ok) { const d = await res.json(); cardLast4 = d.last4 }
          } catch {}
        }

        const startedAt = session.started_at
        const endedAt = session.ended_at ?? new Date().toISOString()
        const durationMinutes = Math.round(
          (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000
        )
        const tables = session.tables as unknown as { name: string } | null
        const venues = session.venues as unknown as { name: string } | null

        setData({
          venueName: venues?.name ?? "Venue",
          receiptNumber: paymentId.slice(-8).toUpperCase(),
          createdAt: payment.created_at,
          tableName: tables?.name ?? "Table",
          startedAt,
          endedAt,
          durationMinutes,
          actualRateCharged: Number(session.actual_rate_charged),
          orderItems: (orderItems ?? []).map((item) => ({
            name: (item.menu_items as unknown as { name: string } | null)?.name ?? "Item",
            quantity: item.quantity,
            price_at_time_cents: item.price_at_time_cents,
            line_total_cents: item.quantity * item.price_at_time_cents,
          })),
          tableTotalCents: payment.table_total_cents,
          itemsTotalCents: payment.items_total_cents,
          taxCents: payment.tax_cents,
          grandTotalCents: payment.grand_total_cents,
          method: payment.method as "card" | "cash" | "terminal",
          cardLast4,
        })
      } catch {
        // fail silently — show empty state
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId, paymentId])

  function handlePrint() {
    window.print()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Screen-only header */}
      <div className="print:hidden mx-auto max-w-md px-4 py-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} aria-label="Back to dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
        </Button>
        <Button size="sm" onClick={handlePrint} aria-label="Print receipt">
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      {/* Receipt */}
      <div className="receipt-print-target mx-auto max-w-md px-4 pb-8">
        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : data ? (
          <Receipt ref={receiptRef} data={data} />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Receipt not found</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
