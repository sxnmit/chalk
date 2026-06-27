"use client"

import { LogOut, DollarSign, Users, CheckCircle, BarChart2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { cn } from "@/lib/utils"

interface StatChipProps {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}

function StatChip({ icon, label, value, highlight = false }: StatChipProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-11 shrink-0 items-center gap-3 rounded-lg border bg-surface px-3 py-2",
        highlight ? "border-success/30" : "border-border"
      )}
    >
      <span className={highlight ? "text-success" : "text-text-muted"}>{icon}</span>
      <div className="flex flex-col">
        <span className="text-caption text-text-muted">{label}</span>
        <span className={cn("text-base font-medium xl:text-xl", highlight ? "font-display text-2xl text-success xl:text-3xl" : "text-text")}>
          {value}
        </span>
      </div>
      {highlight && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-felt" aria-hidden="true" />}
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
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-bg">
      <div className="mx-auto max-w-[1280px] px-4 py-3 sm:px-6 xl:px-8">

        {/* ── Mobile / tablet (both orientations): two rows ────────────────── */}
        {/* Row 1: logo | venue name | logout */}
        <div className="grid grid-cols-3 items-center xl:hidden">
          <Logo />
          <span className="truncate text-center text-h3 text-text">
            {venueName}
          </span>
          <div className="flex items-center justify-end gap-2">
            <ThemeToggle />
            {isOwner && (
              <Button
                onClick={onSummary}
                variant="secondary"
                size="icon"
                aria-label="Today's Summary"
              >
                <BarChart2 className="h-5 w-5" />
              </Button>
            )}
            <Button
              onClick={onLogout}
              variant="ghost"
              size="icon"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
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
          <Logo />

          {/* Center — venue name */}
          <div className="flex min-w-0 justify-center px-6">
            <span className="truncate text-h1 text-text">
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
            <ThemeToggle />
            {isOwner && (
              <Button
                onClick={onSummary}
                variant="secondary"
                size="icon"
                aria-label="Today's Summary"
              >
                <BarChart2 className="h-6 w-6" />
              </Button>
            )}
            <Button
              onClick={onLogout}
              variant="ghost"
              size="icon"
              aria-label="Log out"
            >
              <LogOut className="h-6 w-6" />
            </Button>
          </div>
        </div>

      </div>
    </header>
  )
}
