"use client"

import Image from "next/image"
import { LogOut, DollarSign, Users, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  venueName: string
  todayRevenue: number
  activeTables: number
  completedSessions: number
  onLogout: () => void
}

export function Header({
  venueName,
  todayRevenue,
  activeTables,
  completedSessions,
  onLogout,
}: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Logo and venue name */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Chalk"
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                CHALK
              </span>
              <span className="text-xs text-muted-foreground">{venueName}</span>
            </div>
          </div>

          {/* Stats and logout */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Stats chips - scroll horizontally on mobile */}
            <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <StatChip
                icon={<DollarSign className="h-4 w-4" />}
                label="Today"
                value={`$${todayRevenue.toFixed(2)}`}
                highlight
              />
              <StatChip
                icon={<Users className="h-4 w-4" />}
                label="Active"
                value={`${activeTables}`}
              />
              <StatChip
                icon={<CheckCircle className="h-4 w-4" />}
                label="Sessions"
                value={`${completedSessions}`}
              />
            </div>

            {/* Logout button - subtle but accessible */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">Log out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

interface StatChipProps {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}

function StatChip({ icon, label, value, highlight }: StatChipProps) {
  return (
    <div
      className={`flex shrink-0 items-center gap-3 rounded-lg border px-4 py-2 ${
        highlight
          ? "border-success/30 bg-success/10"
          : "border-border/50 bg-secondary/50"
      }`}
    >
      <span className={`${highlight ? "text-success" : "text-muted-foreground"}`}>
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={`text-lg font-bold ${highlight ? "text-success" : "text-foreground"}`}
        >
          {value}
        </span>
      </div>
    </div>
  )
}
