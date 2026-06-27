"use client"

import { useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { formatCAD } from "@/lib/format"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")

interface StripePaymentFormProps {
  clientSecret: string
  grandTotalCents: number
  returnUrl: string
  onError: (msg: string) => void
}

function CheckoutForm({ grandTotalCents, returnUrl, onError }: Omit<StripePaymentFormProps, "clientSecret">) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })
    if (error) {
      onError(error.message ?? "Payment failed")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      <Button type="submit" disabled={!stripe || submitting} className="w-full" size="lg">
        {submitting ? "Processing…" : `Pay ${formatCAD(grandTotalCents)}`}
      </Button>
    </form>
  )
}

export function StripePaymentForm({ clientSecret, grandTotalCents, returnUrl, onError }: StripePaymentFormProps) {
  const appearance = {
    theme: "night" as const,
    variables: {
      colorPrimary: "oklch(0.7 0.15 195)",
      colorBackground: "oklch(0.18 0.015 240)",
      colorText: "oklch(0.95 0 0)",
      colorDanger: "oklch(0.55 0.2 25)",
      borderRadius: "0.75rem",
    },
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
      <CheckoutForm grandTotalCents={grandTotalCents} returnUrl={returnUrl} onError={onError} />
    </Elements>
  )
}
