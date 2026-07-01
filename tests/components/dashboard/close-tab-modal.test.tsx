import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CloseTabModal } from "@/components/dashboard/close-tab-modal"
import type { OpenTab } from "@/app/dashboard/actions"

const tab: OpenTab = {
  id: "tab1",
  playerName: "Bar 3",
  startedAt: "2026-06-28T18:00:00Z",
  items: [],
  totalCents: 0,
}

describe("CloseTabModal", () => {
  it("shows the tab's name and a no-bill warning", () => {
    render(<CloseTabModal tab={tab} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText("Bar 3")).toBeInTheDocument()
    expect(screen.getByText(/won.t record a bill or payment/i)).toBeInTheDocument()
  })

  it("falls back to a generic label when the tab has no name", () => {
    render(<CloseTabModal tab={{ ...tab, playerName: null }} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText("Tab")).toBeInTheDocument()
  })

  it("calls onConfirm when closing the tab", async () => {
    const onConfirm = vi.fn()
    render(<CloseTabModal tab={tab} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Close Tab" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("calls onCancel when keeping the tab open", async () => {
    const onCancel = vi.fn()
    render(<CloseTabModal tab={tab} onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole("button", { name: "Keep Open" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
