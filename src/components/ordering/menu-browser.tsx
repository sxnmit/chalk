"use client"

import { useMemo, useState } from "react"
import { Loader2, UtensilsCrossed } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { MenuItemCard, type MenuItem } from "./menu-item-card"

interface MenuBrowserProps {
  items: MenuItem[]
  loading: boolean
  onAdd: (item: MenuItem) => void
}

export function MenuBrowser({ items, loading, onAdd }: MenuBrowserProps) {
  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category))).sort()
    return ["All", ...cats]
  }, [items])

  const [activeCategory, setActiveCategory] = useState("All")

  const filtered = useMemo(
    () => (activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory)),
    [items, activeCategory]
  )

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
        <UtensilsCrossed className="h-8 w-8" />
        <p className="text-sm">No menu items yet.</p>
        <a href="/menu" className="text-primary text-sm underline-offset-4 hover:underline">
          Set up your menu →
        </a>
      </div>
    )
  }

  return (
    <Tabs value={activeCategory} onValueChange={setActiveCategory} className="gap-2">
      <TabsList variant="line" className="w-full justify-start overflow-x-auto flex-nowrap flex h-auto pb-0">
        {categories.map((cat) => (
          <TabsTrigger key={cat} value={cat} className="shrink-0 text-xs px-3 py-1.5">
            {cat}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={activeCategory}>
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((item) => (
            <MenuItemCard key={item.id} item={item} onAdd={onAdd} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  )
}
