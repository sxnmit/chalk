"use client"

import type { ReactNode } from "react"
import { BarChart3, LayoutDashboard, Menu, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Menu", href: "/menu", icon: Menu },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
]

interface AppShellProps {
  children: ReactNode
  activeHref?: string
  footer?: ReactNode
}

/** Example: <AppShell activeHref="/dashboard"><Page /></AppShell> */
export function AppShell({ children, activeHref = "/dashboard", footer }: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg text-text lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] border-r border-border bg-surface px-4 py-5 lg:flex lg:flex-col">
        <Logo />
        <nav className="mt-8 grid gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = activeHref === item.href
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[var(--radius)] px-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text",
                  active && "bg-chalk-soft text-chalk"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            )
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          {footer}
          <ThemeToggle />
        </div>
      </aside>
      <main className="min-w-0 pb-20 lg:col-start-2 lg:pb-0">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-surface lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = activeHref === item.href
          return (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className={cn("h-16 flex-col gap-1 rounded-none text-xs", active && "text-chalk")}
            >
              <a href={item.href}>
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            </Button>
          )
        })}
      </nav>
    </div>
  )
}
