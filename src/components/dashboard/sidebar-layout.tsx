"use client"

import type { ReactNode } from "react"
import { useCallback, useState } from "react"
import { SidebarContent } from "@/components/dashboard/sidebar"

interface SidebarLayoutProps {
  venueName: string
  isAdmin: boolean
  isOwner: boolean
  onLogout: () => void
  children: (openSidebar: () => void) => ReactNode
}

export function SidebarLayout({
  venueName,
  isAdmin,
  isOwner,
  onLogout,
  children,
}: SidebarLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false)
  const openSidebar = useCallback(() => setMobileSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setMobileSidebarOpen(false), [])
  const toggleDesktopSidebar = useCallback(() => {
    setDesktopSidebarCollapsed((current) => !current)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col transition-[width] duration-200 lg:flex ${
          desktopSidebarCollapsed ? "w-20" : "w-56"
        }`}
      >
        <SidebarContent
          venueName={venueName}
          isAdmin={isAdmin}
          isOwner={isOwner}
          onLogout={onLogout}
          collapsed={desktopSidebarCollapsed}
          onToggleCollapsed={toggleDesktopSidebar}
        />
      </aside>

      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col transition-transform duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          venueName={venueName}
          isAdmin={isAdmin}
          isOwner={isOwner}
          onLogout={onLogout}
          onClose={closeSidebar}
        />
      </div>

      <div
        className={`flex flex-1 flex-col transition-[margin] duration-200 ${
          desktopSidebarCollapsed ? "lg:ml-20" : "lg:ml-56"
        }`}
      >
        {children(openSidebar)}
      </div>
    </div>
  )
}
