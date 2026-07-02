"use client"

import Link from "next/link"

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-5 p-8 max-w-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <svg className="h-7 w-7 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold font-[family-name:var(--font-exo2)]">Dashboard unavailable</h1>
        <p className="text-sm text-muted-foreground">We couldn&apos;t load the dashboard. Check your connection and try again.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
          >
            Try again
          </button>
          <Link
            href="/login"
            className="px-4 py-2 border border-border rounded-md text-sm font-medium transition-colors hover:bg-accent"
          >
            Log in again
          </Link>
        </div>
      </div>
    </div>
  )
}
