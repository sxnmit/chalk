"use client"

import { Menu, DollarSign, Users, CheckCircle } from "lucide-react"

interface StatChipProps {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}

function StatChip({ icon, label, value, highlight = false }: StatChipProps) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 ${
        highlight
          ? "border-success/30 bg-success/10"
          : "border-border/50 bg-secondary/50"
      }`}
    >
      <span className={highlight ? "text-success" : "text-muted-foreground"}>{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span
          className={`text-base font-bold ${
            highlight ? "text-success" : "text-foreground"
          }`}
        >
          {value}
        </span>
      </div>
    </div>
  )
}

export interface HeaderProps {
  venueName: string
  todayRevenue: number
  activeTables: number
  completedSessions: number
  onOpenSidebar: () => void
}

export function Header({
  venueName,
  todayRevenue,
  activeTables,
  completedSessions,
  onOpenSidebar,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/50">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl pointer-events-none" />

      <div className="relative px-4 py-3 sm:px-6">

        {/* ── Mobile / tablet (<lg): two rows ─────────────────────────────────── */}
        <div className="lg:hidden">
          {/* Row 1: hamburger | venue name */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSidebar}
              aria-label="Open navigation"
              className="touch-manipulation flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10"
            >
              <Menu className="h-5 w-5" />
            </button>

            <span className="text-xl font-bold uppercase tracking-widest text-foreground">
              {venueName}
            </span>
          </div>

          {/* Row 2: stat chips */}
          <div className="mt-3 flex items-center justify-center gap-2 overflow-x-auto">
            <StatChip
              icon={<DollarSign className="h-4 w-4" />}
              label="Today"
              value={`$${todayRevenue.toFixed(2)}`}
              highlight
            />
            <StatChip
              icon={<Users className="h-4 w-4" />}
              label="Active"
              value={String(activeTables)}
            />
            <StatChip
              icon={<CheckCircle className="h-4 w-4" />}
              label="Sessions"
              value={String(completedSessions)}
            />
          </div>
        </div>

        {/* ── Desktop (lg+): single row ─────────────────────────────────────── */}
        <div className="hidden lg:flex lg:items-center lg:py-1">
          {/* Venue name — centered via absolute positioning */}
          <div className="relative flex flex-1 items-center">
            <span className="absolute left-1/2 -translate-x-1/2 text-2xl font-bold uppercase tracking-widest text-foreground whitespace-nowrap">
              {venueName}
            </span>
          </div>

          {/* Stat chips — pinned right */}
          <div className="flex items-center gap-3">
            <StatChip
              icon={<DollarSign className="h-5 w-5" />}
              label="Today's Revenue"
              value={`$${todayRevenue.toFixed(2)}`}
              highlight
            />
            <StatChip
              icon={<Users className="h-5 w-5" />}
              label="Active Tables"
              value={String(activeTables)}
            />
            <StatChip
              icon={<CheckCircle className="h-5 w-5" />}
              label="Sessions Today"
              value={String(completedSessions)}
            />
          </div>
        </div>

      </div>
    </header>
  )
}
