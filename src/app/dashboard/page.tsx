"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { Header, StatBar } from "@/components/dashboard/header"
import { SidebarLayout } from "@/components/dashboard/sidebar-layout"
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

function TableCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card">
      <div className="flex items-center gap-3 p-4 pb-2">
        <div className="h-12 w-12 shrink-0 rounded-full bg-muted animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-4 w-20 rounded-md bg-muted animate-pulse" />
          <div className="h-3 w-10 rounded-md bg-muted animate-pulse" />
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="aspect-video w-full rounded-lg bg-muted animate-pulse" />
        <div className="mt-4 h-11 w-full rounded-xl bg-muted animate-pulse" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [tables, setTables] = useState<PoolTable[]>([])
  const [rates, setRates] = useState<Rate[]>([])
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [todayCompletedSessionsCount, setTodayCompletedSessionsCount] = useState(0)
  const [startModalTable, setStartModalTable] = useState<PoolTable | null>(null)
  const [endModalTable, setEndModalTable] = useState<PoolTable | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [venueName, setVenueName] = useState("")
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
      .then(({ tables, rates, userRole, venueName: name, todayRevenue: revenue, todayCompletedSessionsCount: completed }) => {
        setTables(tables)
        setRates(rates)
        setIsOwner(userRole === "owner")
        setVenueName(name)
        setTodayRevenue(revenue)
        setTodayCompletedSessionsCount(completed)
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
    const {
      tables: freshTables,
      todayRevenue: revenue,
      todayCompletedSessionsCount: completed,
    } = await loadDashboardData()
    setTables(freshTables)
    setTodayRevenue(revenue)
    setTodayCompletedSessionsCount(completed)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

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

  const handleLogout = useCallback(() => {
    logoutAction()
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SidebarLayout venueName={venueName} isOwner={isOwner} onLogout={handleLogout}>
      {(openSidebar) => (
        <>
          <Header
            venueName={venueName}
            onOpenSidebar={openSidebar}
          />

          <StatBar
            todayRevenue={todayRevenue}
            activeTables={activeTables}
            completedSessions={todayCompletedSessionsCount}
          />

          <main className="flex-1 px-4 pb-8 pt-4 sm:px-6 xl:px-8">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <TableCardSkeleton />
                <TableCardSkeleton />
                <TableCardSkeleton />
              </div>
            ) : error ? (
              <p className="text-center text-sm text-destructive">{error}</p>
            ) : isOwner && (rates.length === 0 || tables.length === 0) ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  Get started by setting up your venue
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {rates.length === 0 && (
                    <Link
                      href="/admin/rates"
                      className="rounded-xl border border-border/50 bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      Add your first rate tier →
                    </Link>
                  )}
                  {tables.length === 0 && (
                    <Link
                      href="/admin/tables"
                      className="rounded-xl border border-border/50 bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      Add your first table →
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {tables.map((table, i) => (
                  <div
                    key={table.id}
                    className="animate-card-in"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <TableCard
                      table={table}
                      rates={rates}
                      onStartSession={handleStartSession}
                      onEndSession={handleEndSession}
                    />
                  </div>
                ))}
              </div>
            )}
          </main>

          {/* ── Modals ────────────────────────────────────────────────────── */}
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
        </>
      )}
    </SidebarLayout>
  )
}
