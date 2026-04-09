"use client"

import { useState, useCallback, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { TableCard } from "@/components/dashboard/table-card"
import { StartSessionModal } from "@/components/dashboard/start-session-modal"
import { EndSessionModal } from "@/components/dashboard/end-session-modal"
import { PoolTable, TableSession, RATES, initRates, calculateAmountOwed } from "@/lib/pool-types"
import { logoutAction } from "@/app/login/actions"
import {
  loadDashboardData,
  startSessionAction,
  endSessionAction,
} from "@/app/dashboard/actions"
import { SummaryDrawer } from "@/components/dashboard/summary-drawer"

export default function DashboardPage() {
  const [tables, setTables] = useState<PoolTable[]>([])
  const [completedSessions, setCompletedSessions] = useState<TableSession[]>([])
  const [startModalTable, setStartModalTable] = useState<PoolTable | null>(null)
  const [endModalTable, setEndModalTable] = useState<PoolTable | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)

    const timeout = setTimeout(() => {
      setLoading(false)
      setError("Request timed out. Check your connection and try again.")
    }, 15000)

    loadDashboardData()
      .then(({ tables, rates, userRole }) => {
        initRates(rates)
        setTables(tables)
        setIsOwner(userRole === "owner")
      })
      .catch((err) => {
        console.error("Failed to load dashboard:", err)
        setError(err?.message ?? "Failed to load tables.")
      })
      .finally(() => {
        clearTimeout(timeout)
        setLoading(false)
      })
  }, [])

  const refresh = useCallback(async () => {
    const { tables: freshTables } = await loadDashboardData()
    setTables(freshTables)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeTables = tables.filter((t) => t.session).length

  const todayRevenue = completedSessions.reduce((total, session) => {
    const rate = RATES.find((r) => r.id === session.rateId)
    return total + calculateAmountOwed(session.startTime, rate, session.endTime)
  }, 0)

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
    const completed: TableSession = { ...endModalTable.session, endTime: new Date() }
    await endSessionAction(endModalTable.id)
    setCompletedSessions((prev) => [...prev, completed])
    await refresh()
    setEndModalTable(null)
  }, [endModalTable, refresh])

  const handleLogout = useCallback(() => {
    logoutAction()
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header
        venueName="Shy Lounge"
        todayRevenue={todayRevenue}
        activeTables={activeTables}
        completedSessions={completedSessions.length}
        onLogout={handleLogout}
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
          onConfirm={handleConfirmStart}
          onCancel={() => setStartModalTable(null)}
        />
      )}

      {endModalTable && (
        <EndSessionModal
          table={endModalTable}
          onConfirm={handleConfirmEnd}
          onCancel={() => setEndModalTable(null)}
        />
      )}

      <SummaryDrawer open={summaryOpen} onClose={() => setSummaryOpen(false)} />
    </div>
  )
}
