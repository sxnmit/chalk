"use client"

import type { ReactNode } from "react"
import { useCallback, useState } from "react"
import { SidebarContent } from "@/components/dashboard/sidebar"

interface SidebarLayoutProps {
  venueName: string
  isOwner: boolean
  onLogout: () => void
  children: (openSidebar: () => void) => ReactNode
}

export function SidebarLayout({
  venueName,
  isOwner,
  onLogout,
  children,
}: SidebarLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const openSidebar = useCallback(() => setMobileSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setMobileSidebarOpen(false), [])

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col lg:flex">
        <SidebarContent venueName={venueName} isOwner={isOwner} onLogout={onLogout} />
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
          isOwner={isOwner}
          onLogout={onLogout}
          onClose={closeSidebar}
        />
      </div>

      <div className="flex flex-1 flex-col lg:ml-56">{children(openSidebar)}</div>
    </div>
  )
}
