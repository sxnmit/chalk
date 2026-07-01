"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Menu } from "lucide-react"
import { toast } from "sonner"
import { InviteMemberDialog } from "@/components/billing/invite-member-dialog"
import { TeamMemberRow, type TeamMember } from "@/components/billing/team-member-row"
import { SidebarPageLayout } from "@/components/dashboard/sidebar-page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [removing, setRemoving] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<PendingInvite | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

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
    setError(null)
    const response = await fetch(`/api/team/${memberId}/role`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? "Unable to update role")
      toast.error(data.error ?? "Unable to update role")
    }
    // Always refresh so optimistic UI reflects server state, success or fail.
    load()
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    setError(null)
    const response = await fetch(`/api/team/${removeTarget.id}`, { method: "DELETE" })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? "Unable to remove member")
      toast.error(data.error ?? "Unable to remove member")
      setRemoving(false)
      return
    }
    toast.success(`Removed ${removeTarget.name ?? "member"}`)
    setRemoveTarget(null)
    setRemoving(false)
    load()
  }

  async function confirmRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    setError(null)
    const response = await fetch(`/api/team/invite/${revokeTarget.id}`, { method: "DELETE" })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? "Unable to revoke invite")
      toast.error(data.error ?? "Unable to revoke invite")
      setRevoking(false)
      return
    }
    toast.success(`Revoked invite for ${revokeTarget.email}`)
    setRevokeTarget(null)
    setRevoking(false)
    load()
  }

  const canManage = role === "owner"
  const ownerCount = useMemo(
    () => members.filter((m) => m.role === "owner").length,
    [members]
  )

  return (
    <SidebarPageLayout>
      {(openSidebar) => (
        <>
          <main className="flex-1 px-4 pb-10 pt-6 text-foreground sm:px-6 xl:px-8">
            <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={openSidebar}
              aria-label="Open navigation"
              className="touch-manipulation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-heading text-3xl font-medium">Team</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage access for this venue.</p>
            </div>
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
                isLastOwner={member.role === "owner" && ownerCount <= 1}
                onRoleChange={(nextRole) => changeRole(member.id, nextRole)}
                onRemove={() => setRemoveTarget(member)}
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
              {invites.map((invite) => {
                const expiresAt = new Date(invite.expires_at)
                const expired = nowMs > 0 && expiresAt.getTime() < nowMs
                return (
                  <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Sent {new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(invite.created_at))}
                        {" · "}
                        {expired ? (
                          <span className="text-destructive">Expired</span>
                        ) : (
                          <>Expires {new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(expiresAt)}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">{invite.role}</Badge>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRevokeTarget(invite)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removing) setRemoveTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
            <DialogDescription>
              {removeTarget?.name ?? "This member"} will lose access to the venue immediately.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRemoveTarget(null)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={removing}>
              {removing ? "Removing..." : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !revoking) setRevokeTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke invite?</DialogTitle>
            <DialogDescription>
              The invite for {revokeTarget?.email} will be permanently deleted.
              They will no longer be able to join using this link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRevokeTarget(null)}
              disabled={revoking}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRevoke} disabled={revoking}>
              {revoking ? "Revoking..." : "Revoke invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </main>
        </>
      )}
    </SidebarPageLayout>
  )
}
