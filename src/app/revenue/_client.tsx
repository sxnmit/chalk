"use client"

import { useState, useEffect, useCallback } from "react"
import { DollarSign, Hash, Clock, Menu, CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"
import { SidebarContent } from "@/components/dashboard/sidebar"
import { Calendar } from "@/components/ui/calendar"
import { PopoverRoot, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { logoutAction } from "@/app/login/actions"
import { loadRevenueData, RevenueData } from "./actions"
import { useDeviceType } from "@/hooks/use-device-type"

const VENUE_NAME = "Shy Lounge"

// ── Date helpers ───────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function today(): Date { return startOfDay(new Date()) }

function daysAgo(n: number): Date {
  const d = today()
  d.setDate(d.getDate() - n + 1) // +1 so "7 days" includes today
  return d
}

function toISO(d: Date): string { return d.toISOString() }

/** Exclusive end: midnight of the day after `d`. */
function exclusiveEnd(d: Date): string {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  return next.toISOString()
}

function fmtShort(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d)
}

function fmtFull(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d)
}

function rangeLabel(from: Date | undefined, to: Date | undefined): string {
  if (!from) return "Pick a date range"
  if (!to || from.getTime() === to.getTime()) return fmtFull(from)
  return `${fmtShort(from)} – ${fmtFull(to)}`
}

// ── Presets ────────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Today",    range: () => ({ from: today(), to: today() }) },
  { label: "7 days",   range: () => ({ from: daysAgo(7),  to: today() }) },
  { label: "30 days",  range: () => ({ from: daysAgo(30), to: today() }) },
  { label: "90 days",  range: () => ({ from: daysAgo(90), to: today() }) },
]

// ── Formatters ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatAvgDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12a"
  if (hour < 12) return `${hour}a`
  if (hour === 12) return "12p"
  return `${hour - 12}p`
}

// ── Stat chip ──────────────────────────────────────────────────────────────────

interface StatChipProps {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  large?: boolean
}

function StatChip({ icon, label, value, highlight = false, large = false }: StatChipProps) {
  return (
    <div className={`flex h-full items-center gap-4 rounded-xl border ${large ? "px-6 py-5" : "px-4 py-4"} ${highlight ? "border-success/30 bg-success/10" : "border-border/50 bg-secondary/50"}`}>
      <span className={highlight ? "text-success" : "text-muted-foreground"}>{icon}</span>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`font-bold ${large ? "text-3xl" : "text-2xl"} ${highlight ? "text-success" : "text-foreground"}`}>{value}</div>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

const EMPTY: RevenueData = {
  totalRevenue: 0,
  sessionCount: 0,
  avgSessionMinutes: 0,
  peakHours: new Array(24).fill(0).map((_, hour) => ({ hour, count: 0 })),
  tierBreakdown: [],
}

// ── Revenue page client ────────────────────────────────────────────────────────

export function RevenuePageClient() {
  const [range, setRange] = useState<DateRange>({ from: daysAgo(30), to: today() })
  const [pickerOpen, setPickerOpen] = useState(false)

  const [data, setData] = useState<RevenueData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const deviceType = useDeviceType()

  const fetchData = useCallback(async (from: Date, to: Date) => {
    setLoading(true)
    setError(null)
    try {
      const result = await loadRevenueData(toISO(from), exclusiveEnd(to))
      setData(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load revenue data.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (range.from && range.to) fetchData(range.from, range.to)
  }, [range, fetchData])

  const handleRangeSelect = useCallback((newRange: DateRange | undefined) => {
    if (!newRange) return
    setRange(newRange)
    // Auto-close once both ends are picked
    if (newRange.from && newRange.to) setPickerOpen(false)
  }, [])

  const applyPreset = useCallback((preset: { from: Date; to: Date }) => {
    setRange(preset)
    setPickerOpen(false)
  }, [])

  const maxCount = Math.max(1, ...data.peakHours.map((h) => h.count))

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col lg:flex">
        <SidebarContent
          venueName={VENUE_NAME}
          isOwner={true}
          onLogout={() => logoutAction()}
        />
      </aside>

      {/* ── Mobile sidebar overlay ───────────────────────────────────────────── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Mobile sidebar panel ─────────────────────────────────────────────── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col lg:hidden transition-transform duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          venueName={VENUE_NAME}
          isOwner={true}
          onLogout={() => logoutAction()}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col lg:ml-56">

        {/* ── Top bar ────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-border/50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xl pointer-events-none" />
          <div className="relative flex items-center gap-3 px-4 py-3 sm:px-6">

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation"
              className="touch-manipulation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Title */}
            <span className="flex-1 text-xl font-bold uppercase tracking-widest text-foreground lg:flex-none">
              Revenue
            </span>

            {/* Date range picker — top right */}
            <div className="ml-auto">
              <PopoverRoot open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/50 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-secondary">
                    <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="hidden sm:inline">
                      {rangeLabel(range.from, range.to)}
                    </span>
                    <span className="sm:hidden text-muted-foreground text-xs">
                      {range.from ? fmtShort(range.from) : "Date"}
                    </span>
                  </button>
                </PopoverTrigger>

                <PopoverContent className="p-0 w-auto" align="end">
                  {/* Quick presets — top, immediately reachable */}
                  <div className="flex flex-wrap gap-1.5 border-b border-border/50 px-3 py-2.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => applyPreset(p.range())}
                        className="rounded-lg border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground active:scale-[0.97]"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={handleRangeSelect}
                    numberOfMonths={deviceType === "mobile" ? 1 : 2}
                    disabled={{ after: new Date() }}
                    defaultMonth={range.from}
                    fixedWeeks
                  />
                </PopoverContent>
              </PopoverRoot>
            </div>
          </div>
        </header>

        {/* ── Main content ───────────────────────────────────────────────────── */}
        <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className={`space-y-8 transition-opacity duration-200 ${loading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>

              {/* Stat chips — revenue gets double width to reflect its importance */}
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <StatChip icon={<DollarSign className="h-7 w-7" />} label="Total Revenue" value={formatCurrency(data.totalRevenue)} highlight large />
                </div>
                <StatChip icon={<Hash className="h-6 w-6" />} label="Sessions" value={String(data.sessionCount)} />
                <StatChip icon={<Clock className="h-6 w-6" />} label="Avg Session" value={formatAvgDuration(data.avgSessionMinutes)} />
              </div>

              {/* Peak hours chart */}
              <div className="rounded-xl border border-border/50 bg-card p-5">
                <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Peak Hours</h2>
                <div className="overflow-x-auto">
                  <div className="min-w-[520px]">
                    <div className="flex items-end gap-1 h-[148px]">
                      {data.peakHours.map(({ hour, count }) => {
                        const barH = Math.max(count > 0 ? 4 : 1, Math.round((count / maxCount) * 140))
                        return (
                          <div
                            key={hour}
                            title={`${formatHourLabel(hour)}: ${count} session${count !== 1 ? "s" : ""}`}
                            className="group flex flex-1 flex-col items-center justify-end cursor-default"
                          >
                            <div
                              className="w-full rounded-t bg-primary/40 transition-colors group-hover:bg-primary"
                              style={{ height: `${barH}px` }}
                            />
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-2 flex">
                      {data.peakHours.map(({ hour }) => (
                        <div key={hour} className="flex flex-1 justify-center">
                          <span className="text-[10px] text-muted-foreground">
                            {hour % 6 === 0 ? formatHourLabel(hour) : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rate tier breakdown */}
              <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                <div className="border-b border-border/50 px-5 py-4">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">By Rate Tier</h2>
                </div>
                {data.tierBreakdown.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">No completed sessions in this period.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Rate</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Sessions</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tierBreakdown.map((tier) => (
                        <tr key={tier.label} className="border-b border-border/20 last:border-0 transition-colors hover:bg-muted/20">
                          <td className="px-5 py-3.5 font-medium text-foreground">{tier.label}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{tier.sessionCount}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-success">{formatCurrency(tier.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border/50 bg-secondary/20">
                        <td className="px-5 py-4 text-sm font-semibold text-foreground">Total</td>
                        <td className="px-5 py-4 text-right tabular-nums text-sm text-muted-foreground">
                          {data.tierBreakdown.reduce((s, t) => s + t.sessionCount, 0)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-xl font-bold text-success">
                          {formatCurrency(data.totalRevenue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  )
}
