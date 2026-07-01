"use client"

import { Menu, Users, CheckCircle } from "lucide-react"

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
  onOpenSidebar: () => void
}

export function Header({
  venueName,
  onOpenSidebar,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/50">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl pointer-events-none" />

      <div className="relative px-4 py-3 sm:px-6">
        {/* Mobile: hamburger + venue name */}
        <div className="flex items-center gap-3 lg:hidden">
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

        {/* Desktop: centered venue name */}
        <div className="hidden min-h-14 items-center justify-center lg:flex">
          <span className="text-2xl font-bold uppercase tracking-widest text-foreground">
            {venueName}
          </span>
        </div>
      </div>
    </header>
  )
}

export interface StatBarProps {
  activeTables: number
  completedSessions: number
}

export function StatBar({ activeTables, completedSessions }: StatBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-4 pt-4 sm:px-6 lg:justify-end xl:px-8">
      <StatChip
        icon={<Users className="h-4 w-4 lg:h-5 lg:w-5" />}
        label="Active Tables"
        value={String(activeTables)}
      />
      <StatChip
        icon={<CheckCircle className="h-4 w-4 lg:h-5 lg:w-5" />}
        label="Sessions Today"
        value={String(completedSessions)}
      />
    </div>
  )
}
