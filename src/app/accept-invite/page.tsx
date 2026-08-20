"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  // Invites are accepted on /signup now: the invitee sets a password (claiming
  // the passwordless shell the invite created) rather than relying on the
  // magic-link session in the email, which enterprise mail scanners consume.
  // This route only still exists for invite emails sent before that change —
  // forward them to the same flow.
  useEffect(() => {
    if (token) {
      router.replace(`/signup?token=${encodeURIComponent(token)}`)
    }
  }, [router, token])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <h1 className="font-heading text-2xl font-medium">
          {token ? "Redirecting…" : "Invite problem"}
        </h1>
        {!token && (
          <>
            <p className="mt-2 text-sm text-destructive">Invite token is missing</p>
            <Button className="mt-5" onClick={() => router.push("/login")}>
              Go to login
            </Button>
          </>
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
          <h1 className="font-heading text-2xl font-medium">Redirecting…</h1>
        </section>
      </main>
    }>
      <AcceptInviteContent />
    </Suspense>
  )
}
