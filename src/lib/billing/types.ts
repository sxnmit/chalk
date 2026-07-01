export type VenueRole = "owner" | "manager" | "staff"

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"

export interface RequestProfile {
  userId: string
  email?: string
  venueId: string
  role: VenueRole
}

export interface SubscriptionSummary {
  venueId: string
  status: SubscriptionStatus | "none"
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripePriceId: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export const BLOCKED_SUBSCRIPTION_STATUSES = new Set<string>([
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
])

export function hasRole(role: VenueRole, allowed: VenueRole[]) {
  return allowed.includes(role)
}
