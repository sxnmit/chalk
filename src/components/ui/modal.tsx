"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ModalProps {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  className?: string
}

/** Example: <Modal title="Confirm" onClose={close}>...</Modal> */
export function Modal({ title, description, children, onClose, className }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close modal" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn("relative w-full max-w-md rounded-lg border border-border bg-surface p-6 text-text", className)}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="mb-6 pr-10">
          <h2 id="modal-title" className="text-h2">
            {title}
          </h2>
          {description && <p className="mt-1 text-body-sm text-text-muted">{description}</p>}
        </div>
        {children}
      </section>
    </div>
  )
}
