"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Header } from "@/components/dashboard/header"
import { SidebarContent } from "@/components/dashboard/sidebar"
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

const VENUE_NAME = "Shy Lounge"

export default function DashboardPage() {
  const [tables, setTables] = useState<PoolTable[]>([])
  const [rates, setRates] = useState<Rate[]>([])
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [todayCompletedSessionsCount, setTodayCompletedSessionsCount] = useState(0)
  const [startModalTable, setStartModalTable] = useState<PoolTable | null>(null)
  const [endModalTable, setEndModalTable] = useState<PoolTable | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generation counter: if a new load starts while one is in flight, discard the stale result.
  const loadGenRef = useRef(0)

  const handleLogout = useCallback(async () => {
    await logoutAction()
  }, [])

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
    <div className="flex min-h-screen bg-background">

      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col lg:flex">
        <SidebarContent
          venueName={VENUE_NAME}
          isOwner={isOwner}
          onLogout={handleLogout}
        />
      </aside>
      {/* ── Mobile sidebar overlay ────────────────────────────────────────── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Mobile sidebar panel ──────────────────────────────────────────── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col lg:hidden transition-transform duration-300 ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <SidebarContent
          venueName={VENUE_NAME}
          isOwner={isOwner}
          onLogout={handleLogout}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col lg:ml-56">
        <Header
          venueName={VENUE_NAME}
          todayRevenue={todayRevenue}
          activeTables={activeTables}
          completedSessions={todayCompletedSessionsCount}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 px-4 pb-8 pt-6 sm:px-6 xl:px-8">
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
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
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
    </div>
  )
}
