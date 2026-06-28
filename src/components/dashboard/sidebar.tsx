"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BarChart2,
  LogOut,
  LayoutGrid,
  DollarSign,
  CreditCard,
  Users,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type NavItem = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  ownerOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { key: "menu", label: "Menu", icon: UtensilsCrossed, href: "/menu" },
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
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

export function SidebarContent({
  venueName,
  isOwner,
  onLogout,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: SidebarContentProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner)
  const visibleAdminItems = ADMIN_NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner)

  const itemClass = (active: boolean) =>
    `flex w-full items-center rounded-xl py-2.5 text-sm font-medium transition-colors ${
      collapsed ? "justify-center px-2" : "gap-3 px-4"
    } ${active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
    }`

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo + wordmark */}
      <div
        className={`flex border-b border-white/5 ${
          collapsed ? "h-24 flex-col items-end gap-2 px-3 py-4" : "items-center justify-between gap-3 px-5 py-5"
        }`}
      >
        {collapsed ? (
          <div
            role="img"
            aria-label="Chalk logo"
            className="h-10 w-10 bg-no-repeat"
            style={{
              backgroundImage: "url('/logo.png')",
              backgroundPosition: "-5px center",
              backgroundSize: "110px 40px",
            }}
          />
        ) : (
          <Image
            src="/logo.png"
            alt="Chalk logo"
            width={100}
            height={36}
            className="h-9 w-auto object-contain"
            priority
          />
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground lg:flex"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        )}
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
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          )
        })}

        {visibleAdminItems.length > 0 && (
          <>
            {!collapsed && (
              <p className="mt-4 mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Admin
              </p>
            )}
            {visibleAdminItems.map((item) => {
              const Icon = item.icon
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={itemClass(active)}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Bottom: venue name + logout */}
      <div className={`border-t border-white/5 py-5 ${collapsed ? "px-3" : "px-5"}`}>
        {!collapsed && (
          <p className="mb-3 truncate text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {venueName}
          </p>
        )}
        <button
          onClick={onLogout}
          title={collapsed ? "Logout" : undefined}
          aria-label={collapsed ? "Logout" : undefined}
          className={`flex w-full items-center rounded-xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground ${
            collapsed ? "justify-center px-2" : "gap-3 px-4"
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Logout"}
        </button>
      </div>
    </div>
  )
}
