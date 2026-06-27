"use client"

import { useState, useCallback } from "react"
import { Menu } from "lucide-react"
import { SidebarContent } from "@/components/dashboard/sidebar"
import { RatesAdmin } from "@/components/admin/rates-admin"
import { logoutAction } from "@/app/login/actions"

interface Props {
  venueName: string
}

export function RatesAdminClient({ venueName }: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const handleLogout = useCallback(() => { logoutAction() }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col lg:flex">
        <SidebarContent venueName={venueName} isOwner={true} onLogout={handleLogout} />
      </aside>

      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col lg:hidden transition-transform duration-300 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          venueName={venueName}
          isOwner={true}
          onLogout={handleLogout}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      <div className="flex flex-1 flex-col lg:ml-56">
        <header className="sticky top-0 z-30 border-b border-border/50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xl pointer-events-none" />
          <div className="relative flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation"
              className="touch-manipulation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="flex-1 text-xl font-bold uppercase tracking-widest text-foreground lg:flex-none">
              Rate tiers
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
          <RatesAdmin />
        </main>
      </div>
    </div>
  )
}
