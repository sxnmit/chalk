"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [status, setStatus] = useState("Accepting invite...")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError("Invite token is missing")
      return
    }

    fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
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
        <h1 className="font-heading text-2xl font-medium">{error ? "Invite problem" : status}</h1>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {error && (
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
