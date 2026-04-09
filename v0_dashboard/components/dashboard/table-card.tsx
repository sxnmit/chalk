"use client"

import { useEffect, useState } from "react"
import { Play, Square, Clock, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PoolBall } from "@/components/dashboard/pool-ball"
import {
  PoolTable,
  RATES,
  calculateAmountOwed,
  formatDuration,
  formatTime,
  formatCurrency,
} from "@/lib/types"

interface TableCardProps {
  table: PoolTable
  onStartSession: (tableId: string) => void
  onEndSession: (tableId: string) => void
}

export function TableCard({
  table,
  onStartSession,
  onEndSession,
}: TableCardProps) {
  const isOccupied = !!table.session
  const [, setTick] = useState(0)

  // Update every second for live timer
  useEffect(() => {
    if (!isOccupied) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isOccupied])

  const rate = table.session
    ? RATES.find((r) => r.id === table.session!.rateId)
    : null
  const amountOwed = table.session
    ? calculateAmountOwed(table.session.startTime, rate?.pricePerHour || 15)
    : 0

  return (
    <div
      className={`group relative flex h-[320px] flex-col overflow-hidden rounded-xl border backdrop-blur-sm transition-all ${
        isOccupied
          ? "border-primary/50 bg-card shadow-lg shadow-primary/10"
          : "border-border/50 bg-card hover:border-border"
      }`}
    >
      {/* Live indicator for occupied tables */}
      {isOccupied && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-xs font-medium text-primary">LIVE</span>
        </div>
      )}

      {/* Table number as pool ball */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <PoolBall number={table.tableNumber} size="md" />
        <div>
          <h3 className="font-semibold text-foreground">{table.name}</h3>
          <span
            className={`text-sm ${isOccupied ? "text-primary" : "text-muted-foreground"}`}
          >
            {isOccupied ? "Occupied" : "Free"}
          </span>
        </div>
      </div>

      {/* Card content */}
      <div className="flex flex-1 flex-col px-4 pb-4">
        {isOccupied && table.session ? (
          <OccupiedContent
            session={table.session}
            rate={rate}
            amountOwed={amountOwed}
          />
        ) : (
          <FreeContent />
        )}

        {/* Action button */}
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

function FreeContent() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      {/* Pool table illustration */}
      <div className="relative mb-4 h-24 w-36 rounded-lg bg-[#1a6341] shadow-inner">
        <div className="absolute inset-2 rounded border-4 border-[#8b4513]">
          {/* Pockets */}
          <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-background/80" />
          <div className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full bg-background/80" />
          <div className="absolute -left-1.5 -bottom-1.5 h-3 w-3 rounded-full bg-background/80" />
          <div className="absolute -right-1.5 -bottom-1.5 h-3 w-3 rounded-full bg-background/80" />
          <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-background/80" />
          <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-background/80" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Ready for players</p>
    </div>
  )
}

interface OccupiedContentProps {
  session: NonNullable<PoolTable["session"]>
  rate: { name: string; pricePerHour: number } | null | undefined
  amountOwed: number
}

function OccupiedContent({ session, rate, amountOwed }: OccupiedContentProps) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Player name if set */}
      {session.playerName && (
        <div className="flex items-center gap-2 text-foreground">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{session.playerName}</span>
        </div>
      )}

      {/* Live timer - prominent */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-2xl font-bold text-foreground">
          {formatDuration(session.startTime)}
        </span>
      </div>

      {/* Amount owed - very prominent, green */}
      <div className="rounded-lg bg-success/10 p-3">
        <div className="text-xs uppercase tracking-wider text-success/70">
          Amount Owed
        </div>
        <div className="text-2xl font-bold text-success">
          {formatCurrency(amountOwed)}
        </div>
      </div>

      {/* Rate and start time */}
      <div className="mt-auto flex items-center justify-between text-sm text-muted-foreground">
        <span>{rate?.name || "Standard"} rate</span>
        <span>Started {formatTime(session.startTime)}</span>
      </div>
    </div>
  )
}
