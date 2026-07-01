"use client"

import { useCallback, useEffect, useState } from "react"
import { Menu, Plus, ShoppingBag } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarPageLayout } from "@/components/dashboard/sidebar-page-layout"
import { TabCard } from "@/components/dashboard/tab-card"
import { StartTabModal } from "@/components/dashboard/start-tab-modal"
import { CloseTabModal } from "@/components/dashboard/close-tab-modal"
import { startTabAction, type OpenTab } from "@/app/dashboard/actions"
import { loadOpenTabs, closeTabAction } from "./actions"

export default function TabsPage() {
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [loading, setLoading] = useState(true)
  const [startTabOpen, setStartTabOpen] = useState(false)
  const [closeModalTab, setCloseModalTab] = useState<OpenTab | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const fresh = await loadOpenTabs()
      setTabs(fresh)
    } catch (err) {
      console.error("Failed to load tabs:", err)
      toast.error("Failed to load tabs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleConfirmStartTab = useCallback(
    async (playerName: string) => {
      await startTabAction(playerName || undefined)
      await load()
      setStartTabOpen(false)
    },
    [load]
  )

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (tab && tab.items.length === 0) setCloseModalTab(tab)
    },
    [tabs]
  )

  const handleConfirmClose = useCallback(async () => {
    if (!closeModalTab) return
    try {
      await closeTabAction(closeModalTab.id)
      await load()
    } catch (err) {
      console.error("Failed to close tab:", err)
      toast.error("Failed to close tab")
    } finally {
      setCloseModalTab(null)
    }
  }, [closeModalTab, load])

  return (
    <SidebarPageLayout>
      {(openSidebar) => (
        <>
          <header className="sticky top-0 z-30 border-b border-border/50">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xl pointer-events-none" />
            <div className="relative flex items-center gap-3 px-4 py-3 sm:px-6">
              <button
                onClick={openSidebar}
                aria-label="Open navigation"
                className="touch-manipulation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-xl font-bold uppercase tracking-widest text-foreground">
                Tabs
              </span>
            </div>
          </header>

          <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-exo2)]">
                    Open Tabs
                  </h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Food and drink tabs not tied to a pool table
                  </p>
                </div>
                <Button
                  onClick={() => setStartTabOpen(true)}
                  className="h-11 px-4"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Tab
                </Button>
              </div>

              {loading ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-72 w-full rounded-xl" />
                  ))}
                </div>
              ) : tabs.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/40 px-4 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-muted-foreground">No open tabs.</p>
                  <Button
                    onClick={() => setStartTabOpen(true)}
                    variant="outline"
                    className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Start a Tab
                  </Button>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {tabs.map((tab, i) => (
                    <div
                      key={tab.id}
                      className="animate-card-in"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <TabCard tab={tab} onCloseTab={handleCloseTab} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>

          {startTabOpen && (
            <StartTabModal
              onConfirm={handleConfirmStartTab}
              onCancel={() => setStartTabOpen(false)}
            />
          )}

          {closeModalTab && (
            <CloseTabModal
              tab={closeModalTab}
              onConfirm={handleConfirmClose}
              onCancel={() => setCloseModalTab(null)}
            />
          )}
        </>
      )}
    </SidebarPageLayout>
  )
}
