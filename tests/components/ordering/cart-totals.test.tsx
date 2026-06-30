import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { CartTotals } from "@/components/ordering/cart-totals"

const base = {
  tableTotalCents: 1000,
  itemsTotalCents: 0,
  taxCents: 0,
  grandTotalCents: 1000,
}

describe("CartTotals", () => {
  it("renders skeletons while loading", () => {
    const { container } = render(<CartTotals {...base} loading />)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    expect(screen.queryByText("Table time")).not.toBeInTheDocument()
  })

  it("always shows the table-time line and the grand total", () => {
    render(<CartTotals {...base} tableTotalCents={1000} grandTotalCents={1000} />)
    expect(screen.getByText("Table time")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
    // $10.00 appears on both the table-time row and the total row here.
    expect(screen.getAllByText("$10.00")).toHaveLength(2)
  })

  it("hides the food & drinks line when there are no items", () => {
    render(<CartTotals {...base} />)
    expect(screen.queryByText("Food & drinks")).not.toBeInTheDocument()
  })

  it("shows the food & drinks line when items are present", () => {
    render(<CartTotals {...base} itemsTotalCents={550} grandTotalCents={1550} />)
    expect(screen.getByText("Food & drinks")).toBeInTheDocument()
    expect(screen.getByText("$5.50")).toBeInTheDocument()
  })

  it("hides the tax line when tax is zero and shows it otherwise", () => {
    const { rerender } = render(<CartTotals {...base} />)
    expect(screen.queryByText("Tax")).not.toBeInTheDocument()

    rerender(<CartTotals {...base} taxCents={130} grandTotalCents={1130} />)
    expect(screen.getByText("Tax")).toBeInTheDocument()
    expect(screen.getByText("$1.30")).toBeInTheDocument()
  })
})
