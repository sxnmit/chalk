"use client"

import type { ReactNode } from "react"

const STEPS = ["Venue", "Plan", "Invite", "Done"]

export function OnboardingShell({
  step,
  children,
}: {
  step: number
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col justify-center">
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  index <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>
              <span className="hidden text-xs text-muted-foreground sm:inline">{label}</span>
            </div>
          ))}
        </div>
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          {children}
        </section>
      </div>
    </main>
  )
}
