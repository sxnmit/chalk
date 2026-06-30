import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PoolBall } from "@/components/dashboard/pool-ball"

describe("PoolBall", () => {
  it("renders the ball number", () => {
    render(<PoolBall number={8} />)
    expect(screen.getByText("8")).toBeInTheDocument()
  })

  it("renders a striped gradient for balls 9–15", () => {
    const { container } = render(<PoolBall number={9} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.background).toContain("linear-gradient")
  })

  it("renders a solid background for balls 1–8", () => {
    const { container } = render(<PoolBall number={3} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.background).not.toContain("linear-gradient")
  })

  it("applies the size class", () => {
    const { container } = render(<PoolBall number={1} size="lg" />)
    expect(container.firstElementChild).toHaveClass("h-16", "w-16")
  })

  it("falls back gracefully for an unknown number", () => {
    render(<PoolBall number={99} />)
    expect(screen.getByText("99")).toBeInTheDocument()
  })
})
