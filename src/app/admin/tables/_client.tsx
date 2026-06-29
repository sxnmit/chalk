"use client"

import { useCallback } from "react"
import { Menu } from "lucide-react"
import { SidebarLayout } from "@/components/dashboard/sidebar-layout"
import { TablesAdmin } from "@/components/admin/tables-admin"
import { logoutAction } from "@/app/login/actions"

interface Props {
  venueName: string
}

export function TablesAdminClient({ venueName }: Props) {
  const handleLogout = useCallback(() => { logoutAction() }, [])

  return (
    <SidebarLayout venueName={venueName} isOwner={true} onLogout={handleLogout}>
      {(openSidebar) => (
        <>
        <header className="sticky top-0 z-30 border-b border-border/50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xl pointer-events-none" />
          <div className="relative flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              onClick={openSidebar}
              aria-label="Open navigation"
              className="touch-manipulation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="flex-1 text-xl font-bold uppercase tracking-widest text-foreground lg:flex-none">
              Tables
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
          <div className="mx-auto max-w-4xl">
            <TablesAdmin />
          </div>
        </main>
        </>
      )}
    </SidebarLayout>
  )
}
