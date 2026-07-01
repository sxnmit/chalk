"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OpenTab } from "@/app/dashboard/actions"
import { formatTime } from "@/lib/pool-types"

export interface CloseTabModalProps {
  tab: OpenTab
  onConfirm: () => void
  onCancel: () => void
}

export function CloseTabModal({ tab, onConfirm, onCancel }: CloseTabModalProps) {
  const startTime = new Date(tab.startedAt)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-border/50 bg-card/95 p-6 shadow-2xl backdrop-blur-xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">Close Tab</h2>
          <p className="text-sm text-muted-foreground">{tab.playerName || "Tab"}</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Started</span>
            <span className="text-foreground">{formatTime(startTime)}</span>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This tab has nothing on it yet. Closing it won&apos;t record a bill or payment.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Keep Open
          </Button>
          <Button
            onClick={onConfirm}
            variant="destructive"
            className="flex-1"
          >
            Close Tab
          </Button>
        </div>
      </div>
    </div>
  )
}
