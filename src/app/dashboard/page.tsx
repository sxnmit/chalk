"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Header } from "@/components/dashboard/header"
import { TableCard } from "@/components/dashboard/table-card"
import { StartSessionModal } from "@/components/dashboard/start-session-modal"
import { EndSessionModal } from "@/components/dashboard/end-session-modal"
import { PoolTable, Rate } from "@/lib/pool-types"
import { logoutAction } from "@/app/login/actions"
import {
  loadDashboardData,
  startSessionAction,
  endSessionAction,
} from "@/app/dashboard/actions"
import { SummaryDrawer } from "@/components/dashboard/summary-drawer"

export default function DashboardPage() {
  const [tables, setTables] = useState<PoolTable[]>([])
  const [rates, setRates] = useState<Rate[]>([])
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [todayCompletedSessionsCount, setTodayCompletedSessionsCount] = useState(0)
  const [startModalTable, setStartModalTable] = useState<PoolTable | null>(null)
  const [endModalTable, setEndModalTable] = useState<PoolTable | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generation counter: if a new load starts while one is in flight, discard the stale result.
  const loadGenRef = useRef(0)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)

    const gen = ++loadGenRef.current

    const timeout = setTimeout(() => {
      if (gen !== loadGenRef.current) return
      setLoading(false)
      setError("Request timed out. Check your connection and try again.")
    }, 15000)

    loadDashboardData()
      .then(({ tables, rates, userRole, todayRevenue: revenue, todayCompletedSessionsCount: completed }) => {
        if (gen !== loadGenRef.current) return
        setTables(tables)
        setRates(rates)
        setIsOwner(userRole === "owner")
        setTodayRevenue(revenue)
        setTodayCompletedSessionsCount(completed)
      })
      .catch((err) => {
        if (gen !== loadGenRef.current) return
        console.error("Failed to load dashboard:", err)
        setError(err?.message ?? "Failed to load tables.")
      })
      .finally(() => {
        if (gen !== loadGenRef.current) return
        clearTimeout(timeout)
        setLoading(false)
      })
  }, [])

  const refresh = useCallback(async () => {
    const {
      tables: freshTables,
      todayRevenue: revenue,
      todayCompletedSessionsCount: completed,
    } = await loadDashboardData()
    setTables(freshTables)
    setTodayRevenue(revenue)
    setTodayCompletedSessionsCount(completed)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeTables = tables.filter((t) => t.session).length

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStartSession = useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId)
      if (table) setStartModalTable(table)
    },
    [tables]
  )

  const handleEndSession = useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId)
      if (table?.session) setEndModalTable(table)
    },
    [tables]
  )

  const handleConfirmStart = useCallback(
    async (playerName: string, rateId: string) => {
      if (!startModalTable) return
      await startSessionAction(startModalTable.id, rateId, playerName || undefined)
      await refresh()
      setStartModalTable(null)
    },
    [startModalTable, refresh]
  )

  const handleConfirmEnd = useCallback(async () => {
    if (!endModalTable?.session) return
    await endSessionAction(endModalTable.id)
    await refresh()
    setEndModalTable(null)
  }, [endModalTable, refresh])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header
        venueName="Shy Lounge"
        todayRevenue={todayRevenue}
        activeTables={activeTables}
        completedSessions={todayCompletedSessionsCount}
        onLogout={logoutAction}
        isOwner={isOwner}
        onSummary={() => setSummaryOpen(true)}
      />

      <main className="w-full px-4 pb-8 pt-36 sm:px-6 xl:px-8 xl:pt-48">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading tables…</p>
        ) : error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                rates={rates}
                onStartSession={handleStartSession}
                onEndSession={handleEndSession}
              />
            ))}
          </div>
        )}
      </main>

      {startModalTable && (
        <StartSessionModal
          table={startModalTable}
          rates={rates}
          onConfirm={handleConfirmStart}
          onCancel={() => setStartModalTable(null)}
        />
      )}

      {endModalTable && (
        <EndSessionModal
          table={endModalTable}
          rates={rates}
          onConfirm={handleConfirmEnd}
          onCancel={() => setEndModalTable(null)}
        />
      )}

      <SummaryDrawer open={summaryOpen} onClose={() => setSummaryOpen(false)} />
    </div>
  )
}
