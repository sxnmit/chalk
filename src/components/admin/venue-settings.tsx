"use client"

import { useState, useEffect, useCallback } from "react"
import { Menu, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
}))
const CURRENCY_OPTIONS = ["CAD", "USD", "GBP", "EUR", "AUD"]
const COMMON_TIMEZONES = [
  "America/Toronto", "America/New_York", "America/Chicago",
  "America/Denver", "America/Los_Angeles", "America/Vancouver",
  "America/Edmonton", "America/Winnipeg", "America/Halifax",
  "America/St_Johns", "America/Phoenix",
  "US/Hawaii", "Pacific/Auckland",
  "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Australia/Sydney", "Australia/Melbourne",
]

interface VenueSettingsData {
  name: string
  timezone: string
  tax_rate: number
  currency: string
  peak_days: number[]
  peak_start_hour: number
  peak_end_hour: number
  business_day_cutoff_hour: number
  receipt_footer: string
}

export function VenueSettings({ openSidebar }: { openSidebar?: () => void }) {
  const [data, setData] = useState<VenueSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/settings")
      if (!res.ok) throw new Error("Failed to load settings")
      setData(await res.json())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSave() {
    if (!data) return
    if (data.tax_rate < 0 || data.tax_rate > 100) {
      toast.error("Tax rate must be between 0 and 100")
      return
    }
    if (!data.name.trim()) {
      toast.error("Venue name is required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? "Failed to save")
      }
      toast.success("Settings saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof VenueSettingsData>(key: K, value: VenueSettingsData[K]) {
    setData((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  function togglePeakDay(day: number) {
    if (!data) return
    const next = data.peak_days.includes(day)
      ? data.peak_days.filter((d) => d !== day)
      : [...data.peak_days, day].sort((a, b) => a - b)
    update("peak_days", next)
  }

  const previewTax = data && data.tax_rate > 0
    ? `On a $50.00 subtotal, tax = $${(50 * data.tax_rate / 100).toFixed(2)}`
    : null

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={openSidebar}
          aria-label="Open navigation"
          className="touch-manipulation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-heading text-3xl font-medium">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure venue-level settings.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-48" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* ── Venue Identity ── */}
          <Section title="Venue">
            <Field label="Venue name">
              <Input
                value={data.name}
                onChange={(e) => update("name", e.target.value)}
                maxLength={100}
                className="max-w-sm"
              />
            </Field>
            <Field label="Timezone">
              <select
                value={data.timezone}
                onChange={(e) => update("timezone", e.target.value)}
                className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <select
                value={data.currency}
                onChange={(e) => update("currency", e.target.value)}
                className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </Section>

          {/* ── Tax ── */}
          <Section title="Tax">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="tax-rate">Tax rate (%)</Label>
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.001"
                value={data.tax_rate}
                onChange={(e) => update("tax_rate", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Enter your combined sales tax rate (e.g. 13 for 13% HST).
              </p>
              {previewTax && (
                <p className="text-xs text-muted-foreground italic">{previewTax}</p>
              )}
            </div>
          </Section>

          {/* ── Peak Hours ── */}
          <Section title="Peak Hours">
            <p className="text-xs text-muted-foreground mb-3">
              Sessions that start during peak hours are billed at your highest rate tier. Select which days and hours are considered peak.
            </p>
            <Field label="Peak days">
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => togglePeakDay(i)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      data.peak_days.includes(i)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/50 bg-secondary/50 text-muted-foreground hover:bg-primary/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <Field label="Start time">
                <select
                  value={data.peak_start_hour}
                  onChange={(e) => update("peak_start_hour", parseInt(e.target.value))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="End time">
                <select
                  value={data.peak_end_hour}
                  onChange={(e) => update("peak_end_hour", parseInt(e.target.value))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            {data.peak_days.length > 0 && (
              <p className="text-xs text-muted-foreground italic mt-1">
                Peak window: {data.peak_days.map((d) => DAY_LABELS[d]).join(", ")}{" "}
                {HOUR_OPTIONS[data.peak_start_hour].label} → {HOUR_OPTIONS[data.peak_end_hour].label}
                {data.peak_end_hour <= data.peak_start_hour ? " (next day)" : ""}
              </p>
            )}
          </Section>

          {/* ── Business Day ── */}
          <Section title="Business Day">
            <p className="text-xs text-muted-foreground mb-3">
              Revenue reports group sessions by business day. A business day starts at the cutoff hour — sessions before this time count toward the previous day.
            </p>
            <Field label="Day cutoff hour">
              <select
                value={data.business_day_cutoff_hour}
                onChange={(e) => update("business_day_cutoff_hour", parseInt(e.target.value))}
                className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </Field>
          </Section>

          {/* ── Receipt ── */}
          <Section title="Receipt">
            <Field label="Footer message">
              <Input
                value={data.receipt_footer}
                onChange={(e) => update("receipt_footer", e.target.value)}
                maxLength={500}
                placeholder="Thanks for visiting!"
                className="max-w-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Shown at the bottom of printed receipts. Leave blank to hide.
              </p>
            </Field>
          </Section>

          {/* ── Save ── */}
          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save all settings"}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card">
      <div className="border-b border-border/50 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      </div>
      <div className="px-5 py-5 space-y-4">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
