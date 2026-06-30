"use client"

import { useCallback } from "react"
import { SidebarLayout } from "@/components/dashboard/sidebar-layout"
import { VenueSettings } from "@/components/admin/venue-settings"
import { logoutAction } from "@/app/login/actions"

interface Props {
  venueName: string
}

export function SettingsClient({ venueName }: Props) {
  const handleLogout = useCallback(() => { logoutAction() }, [])

  return (
    <SidebarLayout venueName={venueName} isOwner={true} onLogout={handleLogout}>
      {(openSidebar) => (
        <>
        <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
          <div className="mx-auto max-w-4xl">
            <VenueSettings openSidebar={openSidebar} />
          </div>
        </main>
        </>
      )}
    </SidebarLayout>
  )
}
