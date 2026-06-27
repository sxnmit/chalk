"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Play, Square, Clock, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/ui/status-dot"
import {
  PoolTable,
  TableSession,
  Rate,
  calculateAmountOwed,
  formatDuration,
  formatTime,
  formatCurrency,
} from "@/lib/pool-types"

// ── Sub-components ──────────────────────────────────────────────────────────

function FreeContent() {
  return (
    <div className="flex-1 w-full">
      <div className="relative w-full overflow-hidden rounded-lg bg-surface-2" style={{ aspectRatio: "16/9" }}>
        <Image
          src="/pool_table.webp"
          alt="Pool table"
          loading="eager"
          fill
          className="object-contain"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
    </div>
  )
}

interface OccupiedContentProps {
  session: TableSession
  rate: Rate | undefined
  peakRate: number
}

// Isolated component — only this re-renders every second, not the whole card.
function OccupiedContent({ session, rate, peakRate }: OccupiedContentProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const amountOwed = calculateAmountOwed(session.startTime, rate, peakRate)

  return (
    <div className="flex flex-1 flex-col justify-between py-2">
      {/* Timer + player */}
      <div className="flex flex-col gap-2">
        {session.playerName && (
          <div className="flex items-center gap-2 text-text">
            <User className="h-4 w-4 text-text-muted" />
            <span className="font-medium">{session.playerName}</span>
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          <Clock className="h-5 w-5 text-text-muted" />
          <span className="font-display text-5xl text-text">
            {formatDuration(session.startTime)}
          </span>
        </div>
      </div>

      {/* Amount owed — grows to fill the middle */}
      <div className="my-4 flex flex-1 items-center justify-center rounded-lg border border-success/20 bg-success/10">
        <div className="text-center">
          <div className="text-caption mb-1 text-success/80">Amount Owed</div>
          <div className="font-display text-5xl text-success">{formatCurrency(amountOwed)}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>{rate?.name ?? "Standard"} rate</span>
        <span>Started {formatTime(session.startTime)}</span>
      </div>
    </div>
  )
}

// ── TableCard ────────────────────────────────────────────────────────────────

export interface TableCardProps {
  table: PoolTable
  rates: Rate[]
  onStartSession: (tableId: string) => void
  onEndSession: (tableId: string) => void
}

export function TableCard({ table, rates, onStartSession, onEndSession }: TableCardProps) {
  const isOccupied = !!table.session
  const rate = table.session ? rates.find((r) => r.id === table.session!.rateId) : undefined
  const peakRate = rates.reduce((max, r) => Math.max(max, r.pricePerHour), 0)

  return (
    <div
      className={`group relative flex min-h-[360px] flex-col overflow-hidden rounded-lg border bg-surface transition-colors ${isOccupied
        ? "border-chalk"
        : "border-border hover:border-border-strong"
        }`}
    >
      {/* Table identity */}
      <div className="flex items-start justify-between gap-3 p-5 pb-2">
        <div>
          <h3 className="text-h3 text-text">{table.name}</h3>
          <Badge variant={isOccupied ? "chalk" : "neutral"} size="sm" className="mt-2">
            {isOccupied ? "Occupied" : "Free"}
          </Badge>
        </div>
        <StatusDot number={table.tableNumber} />
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col px-5 pb-5">
        {isOccupied && table.session ? (
          <OccupiedContent session={table.session} rate={rate} peakRate={peakRate} />
        ) : (
          <FreeContent />
        )}

        {/* Action */}
        <div className="mt-auto pt-4">
          {isOccupied ? (
            <Button
              onClick={() => onEndSession(table.id)}
              size="lg"
              className="w-full"
              iconLeft={<Square className="h-4 w-4" />}
            >
              End Session
            </Button>
          ) : (
            <Button
              onClick={() => onStartSession(table.id)}
              variant="secondary"
              size="lg"
              className="w-full"
              iconLeft={<Play className="h-4 w-4" />}
            >
              Start Session
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
