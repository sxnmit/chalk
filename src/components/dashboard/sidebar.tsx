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
} from "lucide-react"

type NavItem = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  adminOnly?: boolean
  ownerOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { key: "menu", label: "Menu", icon: UtensilsCrossed, href: "/menu" },
  { key: "revenue", label: "Revenue", icon: BarChart2, href: "/revenue", ownerOnly: true },
  { key: "billing", label: "Billing", icon: CreditCard, href: "/admin/billing", ownerOnly: true },
  { key: "team", label: "Team", icon: Users, href: "/admin/team", adminOnly: true },
]

const ADMIN_NAV_ITEMS: NavItem[] = [
  { key: "admin-tables", label: "Tables", icon: LayoutGrid, href: "/admin/tables", adminOnly: true },
  { key: "admin-rates", label: "Rate tiers", icon: DollarSign, href: "/admin/rates", adminOnly: true },
]

export interface SidebarContentProps {
  venueName: string
  isAdmin: boolean
  isOwner: boolean
  onLogout: () => void
  onClose?: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

export function SidebarContent({
  venueName,
  isAdmin,
  isOwner,
  onLogout,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: SidebarContentProps) {
  const pathname = usePathname()

  const canSee = (item: NavItem) =>
    (!item.ownerOnly || isOwner) && (!item.adminOnly || isAdmin)
  const visibleItems = NAV_ITEMS.filter(canSee)
  const visibleAdminItems = ADMIN_NAV_ITEMS.filter(canSee)

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
        className={`flex h-[105px] items-center border-b border-white/5 ${
          collapsed ? "justify-center px-3" : "justify-between gap-3 px-5"
        }`}
      >
        {collapsed ? (
          <CollapsedTooltip label="Expand sidebar">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Expand sidebar"
              className="h-12 w-12 rounded-lg bg-no-repeat transition-colors hover:bg-white/5"
              style={{
                backgroundImage: "url('/logo.png')",
                backgroundPosition: "-6px center",
                backgroundSize: "132px 48px",
              }}
            />
          </CollapsedTooltip>
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
        {onToggleCollapsed && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            aria-expanded
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground lg:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          const link = (
            <Link
              key={item.key}
              href={item.href}
              onClick={onClose}
              className={itemClass(active)}
              aria-label={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          )
          return collapsed ? (
            <CollapsedTooltip key={item.key} label={item.label}>
              {link}
            </CollapsedTooltip>
          ) : (
            link
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
              const link = (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={itemClass(active)}
                  aria-label={collapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              )
              return collapsed ? (
                <CollapsedTooltip key={item.key} label={item.label}>
                  {link}
                </CollapsedTooltip>
              ) : (
                link
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
        {collapsed ? (
          <CollapsedTooltip label="Logout">
            <button
              onClick={onLogout}
              aria-label="Logout"
              className="flex w-full items-center justify-center rounded-xl px-2 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <LogOut className="h-4 w-4 shrink-0" />
            </button>
          </CollapsedTooltip>
        ) : (
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Logout
          </button>
        )}
      </div>
    </div>
  )
}

function CollapsedTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="group/tooltip relative">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity duration-100 group-hover/tooltip:opacity-100"
      >
        {label}
      </span>
    </div>
  )
}
