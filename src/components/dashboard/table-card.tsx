"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Play, Square, Clock, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PoolBall } from "@/components/dashboard/pool-ball"
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
      <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "16/9" }}>
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
          <div className="flex items-center gap-2 text-foreground">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{session.playerName}</span>
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="font-mono text-5xl font-bold text-foreground">
            {formatDuration(session.startTime)}
          </span>
        </div>
      </div>

      {/* Amount owed — grows to fill the middle */}
      <div className="flex flex-1 items-center justify-center rounded-xl bg-success/10 my-4">
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-success/70 mb-1">Amount Owed</div>
          <div className="text-5xl font-bold text-success">{formatCurrency(amountOwed)}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
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
      className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all ${isOccupied
        ? "border-primary/50 bg-card shadow-lg shadow-primary/10"
        : "border-border/50 bg-card hover:border-border"
        }`}
    >
      {/* Live indicator */}
      {isOccupied && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-xs font-medium text-primary">LIVE</span>
        </div>
      )}

      {/* Table identity */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <PoolBall number={table.tableNumber} size="md" />
        <div>
          <h3 className="font-semibold text-foreground">{table.name}</h3>
          <span className={`text-sm ${isOccupied ? "text-primary" : "text-muted-foreground"}`}>
            {isOccupied ? "Occupied" : "Free"}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col px-4 pb-4">
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
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              size="lg"
            >
              <Square className="mr-2 h-4 w-4" />
              End Session
            </Button>
          ) : (
            <Button
              onClick={() => onStartSession(table.id)}
              variant="outline"
              className="w-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary"
              size="lg"
            >
              <Play className="mr-2 h-4 w-4" />
              Start Session
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
