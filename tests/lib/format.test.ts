import { describe, it, expect } from "vitest"
import { formatCAD } from "@/lib/format"

describe("formatCAD", () => {
  it("converts cents to a CAD currency string", () => {
    expect(formatCAD(2500)).toBe("$25.00")
    expect(formatCAD(0)).toBe("$0.00")
    expect(formatCAD(199)).toBe("$1.99")
  })

  it("adds thousands separators", () => {
    expect(formatCAD(123456)).toBe("$1,234.56")
  })

  it("rounds sub-cent fractions to two decimals", () => {
    expect(formatCAD(150.4)).toBe("$1.50")
  })

  it("handles negative amounts (refunds)", () => {
    expect(formatCAD(-500)).toBe("-$5.00")
  })
})
