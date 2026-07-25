"use client"

import { useCallback } from "react"
import { SidebarLayout } from "@/components/dashboard/sidebar-layout"
import { ShipmentsAdmin } from "@/components/admin/shipments-admin"
import { logoutAction } from "@/app/login/actions"

interface Props {
  venueName: string
  venueTimezone: string
  isOwner: boolean
}

export function ShipmentsAdminClient({ venueName, venueTimezone, isOwner }: Props) {
  const handleLogout = useCallback(() => { logoutAction() }, [])

  return (
    <SidebarLayout venueName={venueName} isAdmin={true} isOwner={isOwner} onLogout={handleLogout}>
      {(openSidebar) => (
        <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
          <div className="mx-auto max-w-4xl">
            <ShipmentsAdmin openSidebar={openSidebar} venueTimezone={venueTimezone} />
          </div>
        </main>
      )}
    </SidebarLayout>
  )
}
