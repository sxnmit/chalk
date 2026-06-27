"use client"

import Image from "next/image"
import Link from "next/link"
import { LogOut, DollarSign, Users, CheckCircle, BarChart2, UtensilsCrossed } from "lucide-react"

interface StatChipProps {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}

function StatChip({ icon, label, value, highlight = false }: StatChipProps) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 xl:gap-4 xl:px-6 xl:py-3 ${highlight
        ? "border-success/30 bg-success/10"
        : "border-border/50 bg-secondary/50"
        }`}
    >
      <span className={highlight ? "text-success" : "text-muted-foreground"}>{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`text-base font-bold xl:text-2xl ${highlight ? "text-success" : "text-foreground"}`}>
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
  onLogout: () => void
  isOwner?: boolean
  onSummary?: () => void
}

export function Header({
  venueName,
  todayRevenue,
  activeTables,
  completedSessions,
  onLogout,
  isOwner = false,
  onSummary,
}: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 ">
      {/* Blur layer — pointer-events-none so it never intercepts touches */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl pointer-events-none" />
      <div className="relative px-4 py-3 sm:px-6 sm:py-4 xl:px-8 xl:py-5">

        {/* ── Mobile / tablet (both orientations): two rows ────────────────── */}
        {/* Row 1: logo | venue name | logout */}
        <div className="grid grid-cols-3 items-center xl:hidden">
          <Image
            src="/logo.png"
            alt="Chalk logo"
            width={88}
            height={88}
            className="h-10 w-auto object-contain"
            priority
          />
          <span className="text-center text-xl font-bold uppercase tracking-widest text-foreground">
            {venueName}
          </span>
          <div className="flex items-center justify-end gap-2">
            <Link
              href="/menu"
              className="touch-manipulation flex items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-secondary/50 px-3 py-2 text-primary transition-colors hover:bg-primary/10"
              aria-label="Menu admin"
            >
              <UtensilsCrossed className="h-5 w-5" />
              <span className="text-xs font-medium">Menu</span>
            </Link>
            {isOwner && (
              <button
                onClick={onSummary}
                className="touch-manipulation flex items-center justify-center rounded-xl border border-border/50 bg-secondary/50 px-3 py-2 text-primary transition-colors hover:bg-primary/10"
              >
                <BarChart2 className="h-5 w-5" />
                <span className="sr-only">Today's Summary</span>
              </button>
            )}
            <button
              onClick={onLogout}
              className="touch-manipulation flex items-center justify-center rounded-xl border border-border/50 bg-secondary/50 px-3 py-2 text-primary transition-colors hover:bg-primary/10"
            >
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Log out</span>
            </button>
          </div>
        </div>

        {/* Row 2: stats spanning full width */}
        <div className="mt-3 flex items-center justify-center gap-2 overflow-x-auto xl:hidden">
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

        {/* ── Desktop (xl+): single three-column row ───────────────────────── */}
        <div className="hidden xl:grid xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center">
          {/* Left — logo */}
          <div>
            <Image
              src="/logo.png"
              alt="Chalk logo"
              width={88}
              height={88}
              className="h-14 w-auto object-contain xl:h-16"
              priority
            />
          </div>

          {/* Center — venue name */}
          <div className="flex min-w-0 justify-center px-6">
            <span className="truncate text-2xl font-bold uppercase tracking-widest text-foreground xl:text-4xl">
              {venueName}
            </span>
          </div>

          {/* Right — stats + logout */}
          <div className="flex items-center justify-end gap-2 xl:gap-3">
            <div className="flex items-center gap-2 xl:gap-3">
              <StatChip
                icon={<DollarSign className="h-5 w-5" />}
                label="Today"
                value={`$${todayRevenue.toFixed(2)}`}
                highlight
              />
              <StatChip
                icon={<Users className="h-5 w-5" />}
                label="Active"
                value={String(activeTables)}
              />
              <StatChip
                icon={<CheckCircle className="h-5 w-5" />}
                label="Sessions"
                value={String(completedSessions)}
              />
            </div>
            <Link
              href="/menu"
              className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-border/50 bg-secondary/50 px-5 py-3 text-primary transition-colors hover:bg-primary/10"
              aria-label="Menu admin"
            >
              <UtensilsCrossed className="h-5 w-5" />
              <span className="text-sm font-medium">Menu</span>
            </Link>
            {isOwner && (
              <button
                onClick={onSummary}
                className="flex shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 px-6 py-3 text-primary transition-colors hover:bg-primary/10"
              >
                <BarChart2 className="h-6 w-6" />
                <span className="sr-only">Today's Summary</span>
              </button>
            )}
            <button
              onClick={onLogout}
              className="flex shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 px-6 py-3 text-primary transition-colors hover:bg-primary/10"
            >
              <LogOut className="h-6 w-6" />
              <span className="sr-only">Log out</span>
            </button>
          </div>
        </div>

      </div>
    </header>
  )
}
