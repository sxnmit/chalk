"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ToastVariant = "success" | "error" | "info"

interface ToastMessage {
  id: number
  title: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (title: string, variant?: ToastVariant) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<ToastMessage[]>([])

  const toast = React.useCallback((title: string, variant: ToastVariant = "info") => {
    const id = Date.now()
    setMessages((current) => [...current, { id, title, variant }])
    window.setTimeout(() => {
      setMessages((current) => current.filter((message) => message.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-surface px-4 py-3 text-sm text-text shadow-sm transition-transform duration-150 ease-out",
              message.variant === "success" && "border-success/30",
              message.variant === "error" && "border-danger/30",
              message.variant === "info" && "border-border"
            )}
          >
            <span>{message.title}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss notification"
              onClick={() => setMessages((current) => current.filter((item) => item.id !== message.id))}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Example: const { toast } = useToast(); toast("Saved", "success") */
export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider")
  }
  return context
}
