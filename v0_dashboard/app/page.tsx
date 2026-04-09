"use client"

import { useState, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { TableCard } from "@/components/dashboard/table-card"
import { StartSessionModal } from "@/components/dashboard/start-session-modal"
import { EndSessionModal } from "@/components/dashboard/end-session-modal"
import { PoolTable, TableSession, RATES } from "@/lib/types"

// Initial tables for Shy Lounge
const INITIAL_TABLES: PoolTable[] = [
  { id: "1", name: "Table 1", tableNumber: 1 },
  { id: "2", name: "Table 2", tableNumber: 2 },
  { id: "3", name: "Table 3", tableNumber: 3 },
  { id: "4", name: "Table 4", tableNumber: 4 },
  { id: "5", name: "Table 5", tableNumber: 5 },
  { id: "6", name: "Table 6", tableNumber: 6 },
]

export default function Dashboard() {
  const [tables, setTables] = useState<PoolTable[]>(INITIAL_TABLES)
  const [completedSessions, setCompletedSessions] = useState<TableSession[]>([])
  const [startModalTable, setStartModalTable] = useState<PoolTable | null>(null)
  const [endModalTable, setEndModalTable] = useState<PoolTable | null>(null)

  // Calculate stats
  const activeTables = tables.filter((t) => t.session).length

  const todayRevenue = completedSessions.reduce((total, session) => {
    const rate = RATES.find((r) => r.id === session.rateId)
    const durationMs =
      (session.endTime?.getTime() || Date.now()) - session.startTime.getTime()
    const durationHours = durationMs / (1000 * 60 * 60)
    return total + durationHours * (rate?.pricePerHour || 15)
  }, 0)

  // Handlers
  const handleStartSession = useCallback((tableId: string) => {
    const table = INITIAL_TABLES.find((t) => t.id === tableId)
    if (table) {
      setStartModalTable({ ...table })
    }
  }, [])

  const handleEndSession = useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId)
      if (table?.session) {
        setEndModalTable(table)
      }
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
        prev.map((t) =>
          t.id === startModalTable.id ? { ...t, session: newSession } : t
        )
      )
      setStartModalTable(null)
    },
    [startModalTable]
  )

  const handleConfirmEnd = useCallback(() => {
    if (!endModalTable?.session) return

    const completedSession: TableSession = {
      ...endModalTable.session,
      endTime: new Date(),
    }

    setCompletedSessions((prev) => [...prev, completedSession])
    setTables((prev) =>
      prev.map((t) =>
        t.id === endModalTable.id ? { ...t, session: undefined } : t
      )
    )
    setEndModalTable(null)
  }, [endModalTable])

  const handleLogout = useCallback(() => {
    // In a real app, this would handle auth logout
    console.log("Logging out...")
  }, [])

  return (
    <div className="relative min-h-screen bg-background">
      {/* Header */}
      <Header
        venueName="Shy Lounge"
        todayRevenue={todayRevenue}
        activeTables={activeTables}
        completedSessions={completedSessions.length}
        onLogout={handleLogout}
      />

      {/* Main content */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-28 sm:pt-24">
        {/* Table grid */}
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

      {/* Modals */}
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
