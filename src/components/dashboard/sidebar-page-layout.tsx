"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"
import { logoutAction } from "@/app/login/actions"
import { loadNavigationContext } from "@/app/navigation/actions"
import { SidebarLayout } from "@/components/dashboard/sidebar-layout"

interface SidebarPageLayoutProps {
  children: (openSidebar: () => void) => ReactNode
}

export function SidebarPageLayout({ children }: SidebarPageLayoutProps) {
  const [venueName, setVenueName] = useState("Venue")
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    let cancelled = false

    loadNavigationContext()
      .then((context) => {
        if (cancelled) return
        setVenueName(context.venueName)
        setIsOwner(context.isOwner)
      })
      .catch((error) => {
        console.error("Failed to load navigation context:", error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = useCallback(() => {
    logoutAction()
  }, [])

  return (
    <SidebarLayout venueName={venueName} isOwner={isOwner} onLogout={handleLogout}>
      {children}
    </SidebarLayout>
  )
}
