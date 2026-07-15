"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"

function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [status, setStatus] = useState("Accepting invite...")
  const [error, setError] = useState<string | null>(null)
  const displayError = token ? error : "Invite token is missing"

  useEffect(() => {
    if (!token) {
      return
    }

    // The invite link's session lands in the URL fragment (implicit flow —
    // inviteUserByEmail doesn't support PKCE). Instantiating the browser
    // client here triggers its automatic hash detection, which parses the
    // fragment, persists the session, and syncs it into cookies. Awaiting
    // getSession() ensures that finishes before we call an endpoint that
    // depends on the session cookie being present.
    const supabase = createClient()

    supabase.auth
      .getSession()
      .then(() =>
        fetch("/api/auth/accept-invite", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        })
      )
      .then(async (response) => {
        const data = await response.json()
        if (response.status === 401) {
          router.push(`/signup?token=${encodeURIComponent(token)}`)
          return
        }
        if (!response.ok) throw new Error(data.error ?? "Unable to accept invite")
        setStatus("Invite accepted")
        router.push("/dashboard")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to accept invite"))
  }, [router, token])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <h1 className="font-heading text-2xl font-medium">{displayError ? "Invite problem" : status}</h1>
        {displayError && <p className="mt-2 text-sm text-destructive">{displayError}</p>}
        {displayError && (
          <Button className="mt-5" onClick={() => router.push("/login")}>
            Go to login
          </Button>
        )}
      </section>
    </main>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <section className="w-full max-w-md rounded-lg border border-border bg-card p-6">
          <h1 className="font-heading text-2xl font-medium">Accepting invite...</h1>
        </section>
      </main>
    }>
      <AcceptInviteContent />
    </Suspense>
  )
}
