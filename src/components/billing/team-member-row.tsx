"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RoleSelect } from "@/components/billing/role-select"
import type { VenueRole } from "@/lib/billing/types"

export interface TeamMember {
  id: string
  user_id: string
  name: string | null
  role: VenueRole
  created_at: string
}

export function TeamMemberRow({
  member,
  canManage,
  isCurrentUser,
  isLastOwner,
  onRoleChange,
  onRemove,
}: {
  member: TeamMember
  canManage: boolean
  isCurrentUser: boolean
  isLastOwner: boolean
  onRoleChange: (role: VenueRole) => void
  onRemove: () => void
}) {
  const removeDisabled = isCurrentUser || isLastOwner
  const removeTitle = isCurrentUser
    ? "You cannot remove yourself"
    : isLastOwner
    ? "Promote another member to owner first"
    : undefined
  return (
    <div className="grid gap-3 border-b border-border py-4 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <div>
        <p className="font-medium">{member.name ?? member.user_id}</p>
        <p className="text-xs text-muted-foreground">
          Joined {new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(member.created_at))}
        </p>
      </div>
      {canManage ? (
        <RoleSelect
          value={member.role}
          onChange={onRoleChange}
          disabled={(isCurrentUser && member.role === "owner") || isLastOwner}
        />
      ) : (
        <Badge variant="secondary" className="capitalize">
          {member.role}
        </Badge>
      )}
      {canManage && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={removeDisabled}
          title={removeTitle}
          onClick={onRemove}
        >
          <Trash2 />
          <span className="sr-only">Remove member</span>
        </Button>
      )}
    </div>
  )
}
