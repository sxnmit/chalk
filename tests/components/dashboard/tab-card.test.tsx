import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TabCard } from "@/components/dashboard/tab-card"
import type { OpenTab } from "@/app/dashboard/actions"

const emptyTab: OpenTab = {
  id: "tab1",
  playerName: "Bar 3",
  startedAt: "2026-06-28T18:00:00Z",
  items: [],
  totalCents: 0,
}

const tabWithItems: OpenTab = {
  ...emptyTab,
  id: "tab2",
  items: [{ name: "Beer", quantity: 2, lineTotalCents: 1200 }],
  totalCents: 1200,
}

describe("TabCard", () => {
  it("has a full-height root so empty and non-empty tabs stretch equally in the grid", () => {
    const { container } = render(<TabCard tab={emptyTab} onCloseTab={vi.fn()} />)
    expect(container.firstElementChild).toHaveClass("h-full")
  })

  it("offers a no-bill close action when the tab has no items yet", async () => {
    const onCloseTab = vi.fn()
    render(<TabCard tab={emptyTab} onCloseTab={onCloseTab} />)

    const closeButton = screen.getByRole("button", { name: /close \(no bill\)/i })
    await userEvent.click(closeButton)

    expect(onCloseTab).toHaveBeenCalledWith("tab1")
  })

  it("hides the no-bill close action once the tab has items", () => {
    render(<TabCard tab={tabWithItems} onCloseTab={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /close \(no bill\)/i })).not.toBeInTheDocument()
    expect(screen.getByText("Beer")).toBeInTheDocument()
  })

  it("always renders the Order & Bill link", () => {
    render(<TabCard tab={tabWithItems} onCloseTab={vi.fn()} />)
    expect(screen.getByRole("link", { name: /order & bill/i })).toHaveAttribute(
      "href",
      "/session/tab2"
    )
  })
})
