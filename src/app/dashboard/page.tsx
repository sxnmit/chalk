"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { TableCard } from "@/components/dashboard/table-card"
import { StartSessionModal } from "@/components/dashboard/start-session-modal"
import { EndSessionModal } from "@/components/dashboard/end-session-modal"
import { PoolTable, TableSession, RATES } from "@/lib/pool-types"

const INITIAL_TABLES: PoolTable[] = Array.from({ length: 6 }, (_, i) => ({
  id: String(i + 1),
  name: `Table ${i + 1}`,
  tableNumber: i + 1,
}))

export default function DashboardPage() {
  const router = useRouter()
  const [tables, setTables] = useState<PoolTable[]>(INITIAL_TABLES)
  const [completedSessions, setCompletedSessions] = useState<TableSession[]>([])
  const [startModalTable, setStartModalTable] = useState<PoolTable | null>(null)
  const [endModalTable, setEndModalTable] = useState<PoolTable | null>(null)

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeTables = tables.filter((t) => t.session).length

  const todayRevenue = completedSessions.reduce((total, session) => {
    const rate = RATES.find((r) => r.id === session.rateId)
    const durationHours =
      ((session.endTime?.getTime() ?? Date.now()) - session.startTime.getTime()) /
      (1000 * 60 * 60)
    return total + durationHours * (rate?.pricePerHour ?? 15)
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
    (playerName: string, rateId: string) => {
      if (!startModalTable) return
      const newSession: TableSession = {
        id: `session-${Date.now()}`,
        tableId: startModalTable.id,
        playerName: playerName || undefined,
        rateId,
        startTime: new Date(),
      }
      setTables((prev) =>
        prev.map((t) => (t.id === startModalTable.id ? { ...t, session: newSession } : t))
      )
      setStartModalTable(null)
    },
    [startModalTable]
  )

  const handleConfirmEnd = useCallback(() => {
    if (!endModalTable?.session) return
    const completed: TableSession = { ...endModalTable.session, endTime: new Date() }
    setCompletedSessions((prev) => [...prev, completed])
    setTables((prev) =>
      prev.map((t) => (t.id === endModalTable.id ? { ...t, session: undefined } : t))
    )
    setEndModalTable(null)
  }, [endModalTable])

  const handleLogout = useCallback(() => {
    router.push("/login")
  }, [router])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header
        venueName="Shy Lounge"
        todayRevenue={todayRevenue}
        activeTables={activeTables}
        completedSessions={completedSessions.length}
        onLogout={handleLogout}
      />

      <main className="w-full px-4 pb-8 pt-36 sm:px-6 xl:px-8 xl:pt-48">
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
    </div>
  )
}
