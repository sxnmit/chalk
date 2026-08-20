"use client"

import { useState, useEffect, useCallback } from "react"
import { DollarSign, Hash, Clock, Menu, CalendarIcon, CreditCard, Banknote, Download, ScrollText, TrendingUp, TrendingDown, Receipt, LayoutGrid, UtensilsCrossed } from "lucide-react"
import { type DateRange } from "react-day-picker"
import { SidebarPageLayout } from "@/components/dashboard/sidebar-page-layout"
import { Calendar } from "@/components/ui/calendar"
import { PopoverRoot, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { loadRevenueData, exportSessionsCsvAction, exportAuditLogCsvAction, RevenueData } from "./actions"

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

/** Plain `YYYY-MM-DD` for the picked calendar day, with no timezone shift. */
function fmtISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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

function formatCurrency(n: number, currency = "CAD"): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(n)
}

function formatMethod(method: string): string {
  return method.charAt(0).toUpperCase() + method.slice(1)
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

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** `YYYY-MM-DD` bucket date -> short "Mon 12" label, parsed as a plain calendar date (no tz shift). */
function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(y, m - 1, d))
}

/** Percent change vs. a baseline. Null when there's no baseline to compare against. */
function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

// ── Stat chip ──────────────────────────────────────────────────────────────────

interface StatChipProps {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  delta?: number | null
}

function DeltaBadge({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return null
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`mt-0.5 inline-flex items-center gap-1 text-xs font-medium ${up ? "text-success" : "text-destructive"}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(0)}% vs. prior period
    </span>
  )
}

function StatChip({ icon, label, value, highlight = false, delta }: StatChipProps) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${highlight ? "border-success/30 bg-success/10" : "border-border/50 bg-secondary/50"}`}>
      <span className={highlight ? "text-success" : "text-muted-foreground"}>{icon}</span>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${highlight ? "text-success" : "text-foreground"}`}>{value}</div>
        <DeltaBadge pct={delta} />
      </div>
    </div>
  )
}

// ── Breakdown row ──────────────────────────────────────────────────────────────

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular-nums font-medium text-foreground">{value}</dd>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

const EMPTY: RevenueData = {
  totalRevenue: 0,
  grossRevenue: 0,
  refundsTotal: 0,
  tableRevenue: 0,
  itemsRevenue: 0,
  taxCollected: 0,
  tipsCollected: 0,
  sessionCount: 0,
  avgSessionMinutes: 0,
  avgTicket: 0,
  byMethod: [],
  peakHours: new Array(24).fill(0).map((_, hour) => ({ hour, count: 0 })),
  tierBreakdown: [],
  dailyRevenue: [],
  dayOfWeek: DOW_LABELS.map((_, day) => ({ day, revenue: 0 })),
  tableUtilization: [],
  topItems: [],
  previousPeriod: { totalRevenue: 0, sessionCount: 0, avgTicket: 0 },
  currency: "CAD",
}

// ── Revenue page client ────────────────────────────────────────────────────────

export function RevenuePageClient() {
  const [range, setRange] = useState<DateRange>({ from: daysAgo(30), to: today() })
  const [pickerOpen, setPickerOpen] = useState(false)

  const [data, setData] = useState<RevenueData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [exportingAudit, setExportingAudit] = useState(false)
  const [exportAuditError, setExportAuditError] = useState<string | null>(null)

  const fetchData = useCallback(async (from: Date, to: Date) => {
    setLoading(true)
    setError(null)
    try {
      const result = await loadRevenueData(fmtISODate(from), fmtISODate(to))
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

  const handleExport = useCallback(async () => {
    if (!range.from || !range.to) return
    setExporting(true)
    setExportError(null)
    try {
      const { filename, csv } = await exportSessionsCsvAction(fmtISODate(range.from), fmtISODate(range.to))
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : "Failed to export CSV.")
    } finally {
      setExporting(false)
    }
  }, [range])

  const handleExportAudit = useCallback(async () => {
    if (!range.from || !range.to) return
    setExportingAudit(true)
    setExportAuditError(null)
    try {
      const { filename, csv } = await exportAuditLogCsvAction(fmtISODate(range.from), fmtISODate(range.to))
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setExportAuditError(e instanceof Error ? e.message : "Failed to export audit log.")
    } finally {
      setExportingAudit(false)
    }
  }, [range])

  const maxCount = Math.max(1, ...data.peakHours.map((h) => h.count))
  const maxDailyRevenue = Math.max(1, ...data.dailyRevenue.map((d) => d.revenue))
  const dailyLabelStride = Math.max(1, Math.ceil(data.dailyRevenue.length / 10))
  const maxDowRevenue = Math.max(1, ...data.dayOfWeek.map((d) => d.revenue))
  const maxTableOccupiedMinutes = Math.max(1, ...data.tableUtilization.map((t) => t.occupiedMinutes))

  return (
    <SidebarPageLayout>
      {(openSidebar) => (
        <>
        <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
          <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={openSidebar}
                aria-label="Open navigation"
                className="touch-manipulation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="font-heading text-3xl font-medium">Revenue</h1>
                <p className="mt-1 text-sm text-muted-foreground">Track session revenue and peak hours.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={handleRangeSelect}
                    numberOfMonths={1}
                    disabled={{ after: new Date() }}
                    defaultMonth={range.from}
                  />
                  <div className="border-t border-border/50 px-3 py-2 flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => applyPreset(p.range())}
                        className="rounded-lg border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </PopoverRoot>
              <button
                onClick={handleExport}
                disabled={exporting || !range.from || !range.to}
                className="flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/50 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export CSV"}</span>
              </button>
              <button
                onClick={handleExportAudit}
                disabled={exportingAudit || !range.from || !range.to}
                className="flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/50 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="hidden sm:inline">{exportingAudit ? "Exporting…" : "Export Audit Log"}</span>
              </button>
            </div>
          </div>
          {exportError && <p className="mb-4 text-sm text-destructive">{exportError}</p>}
          {exportAuditError && <p className="mb-4 text-sm text-destructive">{exportAuditError}</p>}
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className={`space-y-6 transition-opacity duration-200 ${loading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>

              {/* Stat chips */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatChip
                  icon={<DollarSign className="h-6 w-6" />}
                  label="Total Revenue"
                  value={formatCurrency(data.totalRevenue, data.currency)}
                  highlight
                  delta={deltaPct(data.totalRevenue, data.previousPeriod.totalRevenue)}
                />
                <StatChip
                  icon={<Hash className="h-6 w-6" />}
                  label="Sessions"
                  value={String(data.sessionCount)}
                  delta={deltaPct(data.sessionCount, data.previousPeriod.sessionCount)}
                />
                <StatChip
                  icon={<Receipt className="h-6 w-6" />}
                  label="Avg Ticket"
                  value={formatCurrency(data.avgTicket, data.currency)}
                  delta={deltaPct(data.avgTicket, data.previousPeriod.avgTicket)}
                />
                <StatChip icon={<Clock className="h-6 w-6" />} label="Avg Session" value={formatAvgDuration(data.avgSessionMinutes)} />
              </div>

              {/* Daily revenue trend */}
              <div className="rounded-xl border border-border/50 bg-card p-5">
                <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Revenue Trend</h2>
                {data.dailyRevenue.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No revenue in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[520px]">
                      <div className="flex items-end gap-1 h-[140px]">
                        {data.dailyRevenue.map(({ date, revenue }) => {
                          const barH = Math.max(revenue > 0 ? 4 : 1, Math.round((revenue / maxDailyRevenue) * 130))
                          return (
                            <div key={date} className="group relative flex flex-1 flex-col items-center justify-end cursor-default">
                              <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[9px] tabular-nums text-foreground group-hover:block">
                                {formatCurrency(revenue, data.currency)}
                              </span>
                              <div
                                className="w-full rounded-t bg-primary/40 transition-colors group-hover:bg-primary"
                                style={{ height: `${barH}px` }}
                              />
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-2 flex">
                        {data.dailyRevenue.map(({ date }, i) => (
                          <div key={date} className="flex flex-1 justify-center">
                            <span className="text-[10px] text-muted-foreground">
                              {i % dailyLabelStride === 0 ? formatDayLabel(date) : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Revenue breakdown + payment methods */}
              <div className="grid gap-3 lg:grid-cols-2">
                {/* Where the money came from */}
                <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                  <div className="border-b border-border/50 px-5 py-4">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Breakdown</h2>
                  </div>
                  <dl className="divide-y divide-border/20">
                    <BreakdownRow label="Table time" value={formatCurrency(data.tableRevenue, data.currency)} />
                    <BreakdownRow label="Food & drink" value={formatCurrency(data.itemsRevenue, data.currency)} />
                    <BreakdownRow label="Tax" value={formatCurrency(data.taxCollected, data.currency)} />
                    <BreakdownRow label="Tips" value={formatCurrency(data.tipsCollected, data.currency)} />
                    {data.refundsTotal > 0 && (
                      <div className="flex items-center justify-between px-5 py-3.5">
                        <dt className="text-sm text-muted-foreground">Refunds &amp; voids</dt>
                        <dd className="tabular-nums font-medium text-destructive">-{formatCurrency(data.refundsTotal, data.currency)}</dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-secondary/20 px-5 py-4">
                      <dt className="text-sm font-semibold text-foreground">{data.refundsTotal > 0 ? "Net collected" : "Total collected"}</dt>
                      <dd className="tabular-nums text-lg font-bold text-success">{formatCurrency(data.totalRevenue, data.currency)}</dd>
                    </div>
                  </dl>
                </div>

                {/* How they paid */}
                <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                  <div className="border-b border-border/50 px-5 py-4">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Payment Methods</h2>
                  </div>
                  {data.byMethod.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-muted-foreground">No payments in this period.</p>
                  ) : (
                    <dl className="divide-y divide-border/20">
                      {data.byMethod.map((m) => (
                        <div key={m.method} className="flex items-center justify-between px-5 py-3.5">
                          <dt className="flex items-center gap-3 text-sm font-medium text-foreground">
                            <span className="text-muted-foreground">
                              {m.method === "cash" ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                            </span>
                            {formatMethod(m.method)}
                            <span className="text-xs text-muted-foreground">({m.count})</span>
                          </dt>
                          <dd className="tabular-nums font-semibold text-success">{formatCurrency(m.revenue, data.currency)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>

              {/* Peak hours chart */}
              <div className="rounded-xl border border-border/50 bg-card p-5">
                <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Peak Hours</h2>
                <div className="overflow-x-auto">
                  <div className="min-w-[520px]">
                    <div className="flex items-end gap-1 h-[110px]">
                      {data.peakHours.map(({ hour, count }) => {
                        const barH = Math.max(count > 0 ? 4 : 1, Math.round((count / maxCount) * 100))
                        return (
                          <div
                            key={hour}
                            className="group relative flex flex-1 flex-col items-center justify-end cursor-default"
                          >
                            {count > 0 && (
                              <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 text-[9px] tabular-nums text-foreground group-hover:block">
                                {count}
                              </span>
                            )}
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

              {/* Revenue by day of week */}
              <div className="rounded-xl border border-border/50 bg-card p-5">
                <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Revenue by Day of Week</h2>
                <div className="flex items-end gap-2 h-[110px]">
                  {data.dayOfWeek.map(({ day, revenue }) => {
                    const barH = Math.max(revenue > 0 ? 4 : 1, Math.round((revenue / maxDowRevenue) * 100))
                    return (
                      <div key={day} className="group relative flex flex-1 flex-col items-center justify-end cursor-default">
                        <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[9px] tabular-nums text-foreground group-hover:block">
                          {formatCurrency(revenue, data.currency)}
                        </span>
                        <div
                          className="w-full rounded-t bg-primary/40 transition-colors group-hover:bg-primary"
                          style={{ height: `${barH}px` }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  {data.dayOfWeek.map(({ day }) => (
                    <div key={day} className="flex flex-1 justify-center">
                      <span className="text-[10px] text-muted-foreground">{DOW_LABELS[day]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table utilization */}
              <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Table Utilization</h2>
                </div>
                {data.tableUtilization.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">No table sessions in this period.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Table</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Sessions</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg Length</th>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Occupancy</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tableUtilization.map((t) => (
                        <tr key={t.tableName} className="border-b border-border/20 last:border-0">
                          <td className="px-5 py-3.5 font-medium text-foreground">{t.tableName}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{t.sessionCount}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{formatAvgDuration(t.avgSessionMinutes)}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${Math.max(2, (t.occupiedMinutes / maxTableOccupiedMinutes) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-muted-foreground">{t.utilizationPct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-success">{formatCurrency(t.revenue, data.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top selling items */}
              <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
                  <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Top Selling Items</h2>
                </div>
                {data.topItems.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">No food & drink orders in this period.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Item</th>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Category</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Qty Sold</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topItems.map((item, i) => (
                        <tr key={`${item.name}-${i}`} className="border-b border-border/20 last:border-0">
                          <td className="px-5 py-3.5 font-medium text-foreground">{item.name}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{item.category}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{item.quantitySold}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-success">{formatCurrency(item.revenue, data.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Rate tier breakdown */}
              <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                <div className="border-b border-border/50 px-5 py-4">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Table Revenue by Rate Tier</h2>
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
                        <tr key={tier.label} className="border-b border-border/20 last:border-0">
                          <td className="px-5 py-3.5 font-medium text-foreground">{tier.label}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{tier.sessionCount}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-success">{formatCurrency(tier.revenue, data.currency)}</td>
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
                          {formatCurrency(data.tableRevenue, data.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

            </div>
          )}
          </div>
        </main>
        </>
      )}
    </SidebarPageLayout>
  )
}
