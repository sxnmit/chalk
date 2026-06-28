import Link from "next/link"
import { BillingPortalButton } from "@/components/billing/billing-portal-button"
import { Button } from "@/components/ui/button"
import { getRequestProfile } from "@/lib/billing/server"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

async function loadOwnerContacts(venueId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data: owners } = await admin
    .from("venue_members")
    .select("user_id")
    .eq("venue_id", venueId)
    .eq("role", "owner")
  const ownerIds = (owners ?? []).map((o) => o.user_id)
  if (ownerIds.length === 0) return []

  const { data: users } = await admin.auth.admin.listUsers()
  return (users?.users ?? [])
    .filter((u) => ownerIds.includes(u.id) && u.email)
    .map((u) => u.email as string)
}

export default async function BillingBlockedPage() {
  const supabase = await createClient()
  const profile = await getRequestProfile(supabase)
  const isOwner = profile?.role === "owner"
  const ownerEmails = profile && !isOwner ? await loadOwnerContacts(profile.venueId) : []

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <h1 className="font-heading text-2xl font-medium">Subscription needed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This venue needs an active subscription before the app can be used.
        </p>

        {!isOwner && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
            {ownerEmails.length > 0 ? (
              <>
                <p className="font-medium">Ask an owner to update billing:</p>
                <ul className="mt-2 space-y-1">
                  {ownerEmails.map((email) => (
                    <li key={email}>
                      <a
                        href={`mailto:${email}?subject=Chalk%20subscription%20needs%20attention`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {email}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-muted-foreground">
                Ask an owner of this venue to update the subscription.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {isOwner && <BillingPortalButton />}
          <Button asChild variant="outline">
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
