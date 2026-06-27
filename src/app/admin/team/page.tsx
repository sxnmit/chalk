"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { InviteMemberDialog } from "@/components/billing/invite-member-dialog"
import { TeamMemberRow, type TeamMember } from "@/components/billing/team-member-row"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { VenueRole } from "@/lib/billing/types"

interface PendingInvite {
  id: string
  email: string
  role: VenueRole
  created_at: string
  expires_at: string
}

export default function AdminTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [role, setRole] = useState<VenueRole | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch("/api/team")
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? "Unable to load team")
        setMembers(data.members)
        setInvites(data.invites)
        setRole(data.role)
        setCurrentUserId(data.currentUserId)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load team"))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function changeRole(memberId: string, nextRole: VenueRole) {
    const response = await fetch(`/api/team/${memberId}/role`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    })
    if (!response.ok) {
      const data = await response.json()
      setError(data.error ?? "Unable to update role")
      return
    }
    load()
  }

  async function removeMember(memberId: string) {
    const response = await fetch(`/api/team/${memberId}`, { method: "DELETE" })
    if (!response.ok) {
      const data = await response.json()
      setError(data.error ?? "Unable to remove member")
      return
    }
    load()
  }

  const canManage = role === "owner"

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Button asChild variant="ghost" className="mb-6">
          <Link href="/dashboard">
            <ArrowLeft />
            Dashboard
          </Link>
        </Button>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-medium">Team</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage access for this venue.</p>
          </div>
          {canManage && <InviteMemberDialog onInvited={load} />}
        </div>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <section className="rounded-lg border border-border bg-card p-5">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            members.map((member) => (
              <TeamMemberRow
                key={member.id}
                member={member}
                canManage={canManage}
                isCurrentUser={member.user_id === currentUserId}
                onRoleChange={(nextRole) => changeRole(member.id, nextRole)}
                onRemove={() => removeMember(member.id)}
              />
            ))
          )}
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 font-heading text-lg font-medium">Pending invites</h2>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent {new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(invite.created_at))}
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize">{invite.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
