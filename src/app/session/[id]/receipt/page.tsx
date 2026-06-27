"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Printer, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Receipt, type ReceiptData } from "@/components/ordering/receipt"

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
        const res = await fetch(`/api/sessions/${sessionId}/receipt?payment_id=${paymentId}`)
        if (!res.ok) throw new Error("Not found")
        setData(await res.json())
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
