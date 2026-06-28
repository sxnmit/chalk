"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, BarChart2, LogOut, LayoutGrid, DollarSign, CreditCard, Users } from "lucide-react"

type NavItem = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  ownerOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { key: "revenue", label: "Revenue", icon: BarChart2, href: "/revenue", ownerOnly: true },
  { key: "billing", label: "Billing", icon: CreditCard, href: "/admin/billing", ownerOnly: true },
  { key: "team", label: "Team", icon: Users, href: "/admin/team", ownerOnly: true },
]

const ADMIN_NAV_ITEMS: NavItem[] = [
  { key: "admin-tables", label: "Tables", icon: LayoutGrid, href: "/admin/tables", ownerOnly: true },
  { key: "admin-rates", label: "Rate tiers", icon: DollarSign, href: "/admin/rates", ownerOnly: true },
]

export interface SidebarContentProps {
  venueName: string
  isOwner: boolean
  onLogout: () => void
  onClose?: () => void
}

export function SidebarContent({
  venueName,
  isOwner,
  onLogout,
  onClose,
}: SidebarContentProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner)
  const visibleAdminItems = ADMIN_NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner)

  const itemClass = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
    }`

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo + wordmark */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
        <Image
          src="/logo.png"
          alt="Chalk logo"
          width={40}
          height={40}
          className="h-9 w-auto object-contain"
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onClose}
              className={itemClass(active)}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {visibleAdminItems.length > 0 && (
          <>
            <p className="mt-4 mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Admin
            </p>
            {visibleAdminItems.map((item) => {
              const Icon = item.icon
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={itemClass(active)}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Bottom: venue name + logout */}
      <div className="border-t border-white/5 px-5 py-5">
        <p className="mb-3 truncate text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {venueName}
        </p>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  )
}
