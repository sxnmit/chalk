import { formatCAD } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"

interface CartTotalsProps {
  tableTotalCents: number
  itemsTotalCents: number
  taxCents: number
  grandTotalCents: number
  loading?: boolean
}

export function CartTotals({ tableTotalCents, itemsTotalCents, taxCents, grandTotalCents, loading }: CartTotalsProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Table time</span>
        <span className="tabular-nums">{formatCAD(tableTotalCents)}</span>
      </div>
      {itemsTotalCents > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>Food & drinks</span>
          <span className="tabular-nums">{formatCAD(itemsTotalCents)}</span>
        </div>
      )}
      {taxCents > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>Tax</span>
          <span className="tabular-nums">{formatCAD(taxCents)}</span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between font-bold text-base text-foreground">
        <span>Total</span>
        <span className="text-success tabular-nums">{formatCAD(grandTotalCents)}</span>
      </div>
    </div>
  )
}
