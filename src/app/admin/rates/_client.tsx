"use client"

import { useCallback } from "react"
import { SidebarLayout } from "@/components/dashboard/sidebar-layout"
import { RatesAdmin } from "@/components/admin/rates-admin"
import { logoutAction } from "@/app/login/actions"

interface Props {
  venueName: string
  isOwner: boolean
}

export function RatesAdminClient({ venueName, isOwner }: Props) {
  const handleLogout = useCallback(() => { logoutAction() }, [])

  return (
    <SidebarLayout venueName={venueName} isAdmin={true} isOwner={isOwner} onLogout={handleLogout}>
      {(openSidebar) => (
        <>
        <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
          <div className="mx-auto max-w-4xl">
            <RatesAdmin openSidebar={openSidebar} />
          </div>
        </main>
        </>
      )}
    </SidebarLayout>
  )
}
