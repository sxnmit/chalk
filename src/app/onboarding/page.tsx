"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Building2, CheckCircle2 } from "lucide-react"
import { OnboardingShell } from "@/components/billing/onboarding-shell"
import { PlanCard } from "@/components/billing/plan-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/client"

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const checkoutResult = searchParams.get("checkout")
  const [step, setStep] = useState(checkoutResult === "success" ? 2 : 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [venue, setVenue] = useState({
    name: "",
    addressLine1: "",
    city: "",
    postalCode: "",
    country: "CA",
    timezone: "America/Toronto",
  })
  const [inviteEmail, setInviteEmail] = useState("")

  async function createVenue() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/onboarding/venue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(venue),
      })
      const data = await response.json()
      if (response.status === 409) {
        await createClient().auth.refreshSession()
        setStep(1)
        return
      }
      if (!response.ok) throw new Error(data.error ?? "Unable to create venue")

      // The user's JWT was minted at signup, before this venue (and the
      // venue_members row) existed — so `app_metadata.venue_id` is still
      // empty. Most RLS policies (subscriptions, venue_members, venues)
      // read that claim, which means every subsequent SSR-client query in
      // the onboarding/dashboard flow would silently return nothing and
      // the middleware would bounce /dashboard back to /onboarding.
      // Force a refresh so the custom_access_token_hook re-runs and bakes
      // the now-populated venue_id into a fresh access token.
      await createClient().auth.refreshSession()
      setStep(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create venue")
    } finally {
      setLoading(false)
    }
  }

  async function sendInvite() {
    if (!inviteEmail) {
      setStep(3)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: "staff" }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Unable to send invite")
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send invite")
    } finally {
      setLoading(false)
    }
  }

  async function finish() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/onboarding/complete", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Unable to complete onboarding")
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete onboarding")
      setLoading(false)
    }
  }

  return (
    <OnboardingShell step={step}>
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <Building2 className="mb-3 h-8 w-8 text-primary" />
            <h1 className="font-heading text-2xl font-medium">Set up your venue</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create the venue that your staff and billing will belong to.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="venue-name">Venue name</Label>
              <Input id="venue-name" value={venue.name} onChange={(event) => setVenue({ ...venue, name: event.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={venue.addressLine1} onChange={(event) => setVenue({ ...venue, addressLine1: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={venue.city} onChange={(event) => setVenue({ ...venue, city: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal">Postal code</Label>
              <Input id="postal" value={venue.postalCode} onChange={(event) => setVenue({ ...venue, postalCode: event.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={createVenue} disabled={loading || !venue.name}>
            {loading ? "Creating..." : "Continue"}
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h1 className="font-heading text-2xl font-medium">Choose your plan</h1>
            <p className="mt-1 text-sm text-muted-foreground">Subscribe to get started with Chalk.</p>
          </div>
          <PlanCard onContinue={async () => {
            setLoading(true)
            setError(null)
            try {
              const response = await fetch("/api/onboarding/checkout", { method: "POST" })
              const data = await response.json()
              if (!response.ok) throw new Error(data.error ?? "Unable to start checkout")
              window.location.href = data.url
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unable to start checkout")
              setLoading(false)
            }
          }} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h1 className="font-heading text-2xl font-medium">Invite your team</h1>
            <p className="mt-1 text-sm text-muted-foreground">Optional. You can manage members later from Team.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite">Staff email</Label>
            <Input id="invite" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={sendInvite} disabled={loading}>{loading ? "Sending..." : "Continue"}</Button>
            <Button variant="outline" onClick={() => setStep(3)}>Skip</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <CheckCircle2 className="h-10 w-10 text-primary" />
          <div>
            <h1 className="font-heading text-2xl font-medium">You are all set</h1>
            <p className="mt-1 text-sm text-muted-foreground">Chalk is ready for your venue.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={finish} disabled={loading}>{loading ? "Finishing..." : "Go to dashboard"}</Button>
        </div>
      )}
    </OnboardingShell>
  )
}
