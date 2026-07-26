import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// sonner isn't mounted in tests; stub the toast so we can assert on it.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"
import { RefundDialog } from "@/components/ordering/refund-dialog"

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  sessionId: "s1",
  paymentId: "p1",
  remainingCents: 8506, // $85.06
  currency: "CAD",
  onRefunded: vi.fn(),
}

/** The submit CTA is the only button whose label carries a "$" amount. */
const submitButton = () => screen.getByRole("button", { name: /\$/ })
const amountField = () => screen.getByLabelText("Amount")
const reasonField = () => screen.getByLabelText("Reason (required)")

function mockFetchOk() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, refund: { id: "ref1" } }),
  })
  global.fetch = fetchMock as never
  return fetchMock
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("RefundDialog", () => {
  it("submits a typed partial amount (12.50 → 1250 cents)", async () => {
    const fetchMock = mockFetchOk()
    const onRefunded = vi.fn()
    const user = userEvent.setup()
    render(<RefundDialog {...baseProps} onRefunded={onRefunded} />)

    await user.clear(amountField())
    await user.type(amountField(), "12.50")
    expect(amountField()).toHaveValue("12.50")

    await user.type(reasonField(), "mis-ring")
    await user.click(submitButton())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/sessions/s1/refund")
    const body = JSON.parse((init as { body: string }).body)
    expect(body).toMatchObject({
      payment_id: "p1",
      amount_cents: 1250,
      reason: "mis-ring",
      kind: "refund",
    })

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("12.50"))
    expect(onRefunded).toHaveBeenCalledTimes(1)
  })

  it("selecting Void disables the amount field and forces the full remaining balance", async () => {
    mockFetchOk()
    const user = userEvent.setup()
    render(<RefundDialog {...baseProps} />)

    await user.click(screen.getByRole("button", { name: "Void" }))

    expect(amountField()).toBeDisabled()
    expect(amountField()).toHaveValue("85.06")

    await user.type(reasonField(), "walkout")
    await user.click(submitButton())

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ amount_cents: 8506, kind: "void" })
  })

  it("keeps submit disabled until a non-empty reason is entered", async () => {
    mockFetchOk()
    const user = userEvent.setup()
    render(<RefundDialog {...baseProps} />)

    // Amount is pre-filled with the full balance, so only the reason is missing.
    expect(submitButton()).toBeDisabled()

    await user.type(reasonField(), "mis-ring")
    expect(submitButton()).toBeEnabled()

    await user.clear(reasonField())
    expect(submitButton()).toBeDisabled()
  })

  it("shows an 'exceeds balance' hint and disables submit when over the balance", async () => {
    mockFetchOk()
    const user = userEvent.setup()
    render(<RefundDialog {...baseProps} />)

    await user.clear(amountField())
    await user.type(amountField(), "999.99") // > $85.06
    await user.type(reasonField(), "mis-ring")

    expect(screen.getByText(/Exceeds refundable balance/i)).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it("never renders NaN and disables submit when the amount is cleared", async () => {
    mockFetchOk()
    const user = userEvent.setup()
    render(<RefundDialog {...baseProps} />)

    await user.clear(amountField())
    expect(amountField()).toHaveValue("")
    expect(submitButton()).toBeDisabled()
  })

  it("surfaces a server error via a sonner toast without closing the dialog", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "This payment can't be refunded (not a completed sale)." }),
    }) as never
    const onOpenChange = vi.fn()
    const onRefunded = vi.fn()
    const user = userEvent.setup()
    render(<RefundDialog {...baseProps} onOpenChange={onOpenChange} onRefunded={onRefunded} />)

    await user.type(reasonField(), "mis-ring")
    await user.click(submitButton())

    expect(toast.error).toHaveBeenCalledWith("This payment can't be refunded (not a completed sale).")
    expect(onRefunded).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("formats amounts in the venue currency (USD), not hardcoded CAD", async () => {
    mockFetchOk()
    render(<RefundDialog {...baseProps} currency="USD" remainingCents={5000} />)
    // narrowSymbol USD renders "$50.00"; the point is the dialog respects the
    // passed currency rather than always using CAD.
    expect(screen.getByText("$50.00")).toBeInTheDocument()
  })
})
