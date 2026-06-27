"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { VenueRole } from "@/lib/billing/types"

export function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: VenueRole
  onChange: (role: VenueRole) => void
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={(role) => onChange(role as VenueRole)} disabled={disabled}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">Owner</SelectItem>
        <SelectItem value="manager">Manager</SelectItem>
        <SelectItem value="staff">Staff</SelectItem>
      </SelectContent>
    </Select>
  )
}
