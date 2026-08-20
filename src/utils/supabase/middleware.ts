import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const BLOCKED_STATUSES = new Set([
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
])

function isExemptPath(pathname: string) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/billing/blocked') ||
    pathname.startsWith('/accept-invite') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/auth/accept-invite') ||
    pathname.startsWith('/api/auth/claim-invite') ||
    pathname.startsWith('/api/billing/portal')
  )
}

function isOnboardingPath(pathname: string) {
  return (
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/api/onboarding')
  )
}

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/revenue') ||
    pathname.startsWith('/menu') ||
    pathname.startsWith('/session') ||
    pathname.startsWith('/admin')
  )
}

// API surfaces that mutate venue state and must respect the subscription
// paywall. /api/billing/portal and /api/webhooks/* are intentionally exempt
// (the portal is the user's escape hatch; webhooks are signed by Stripe).
function isPaywalledApiPath(pathname: string) {
  return (
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/menu') ||
    pathname.startsWith('/api/sessions') ||
    pathname.startsWith('/api/team') ||
    pathname.startsWith('/api/billing/checkout')
  )
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  return NextResponse.redirect(url)
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const protectedRoute = isProtectedPath(request.nextUrl.pathname)

  if (protectedRoute && !user) {
    return redirectTo(request, '/login')
  }

  if (isAuthRoute && user) {
    return redirectTo(request, '/dashboard')
  }

  if (!user || isExemptPath(request.nextUrl.pathname)) {
    return supabaseResponse
  }

  // Hook-issued claims (venue_id, role) live on the JWT, not on auth.users.
  let jwtAppMetadata: { venue_id?: string; active_venue_id?: string; role?: string } = {}
  if (session?.access_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(session.access_token.split('.')[1], 'base64').toString('utf8')
      )
      jwtAppMetadata = payload.app_metadata ?? {}
    } catch {
      jwtAppMetadata = {}
    }
  }

  let venueId = jwtAppMetadata.active_venue_id ?? jwtAppMetadata.venue_id
  const onboardingRoute = isOnboardingPath(request.nextUrl.pathname)
  const paywalledApiRoute = isPaywalledApiPath(request.nextUrl.pathname)

  // JWT claims may not be issued yet for brand-new signups (hook timing).
  // Fall back to venue_members so onboarding-completed users aren't bounced
  // back to /onboarding on every request until their next token refresh.
  if (!venueId && (protectedRoute || onboardingRoute || paywalledApiRoute)) {
    const { data: membership } = await supabase
      .from('venue_members')
      .select('venue_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    venueId = membership?.venue_id ?? undefined
  }

  // Resolve onboarding state once when we need it for either a protected
  // route check or to guard the onboarding route itself.
  let onboardingComplete = false
  if (venueId && (protectedRoute || onboardingRoute || paywalledApiRoute)) {
    const { data: venue } = await supabase
      .from('venues')
      .select('onboarding_completed_at')
      .eq('id', venueId)
      .maybeSingle()

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('venue_id', venueId)
      .maybeSingle()

    onboardingComplete = Boolean(venue?.onboarding_completed_at && subscription)

    if (subscription && BLOCKED_STATUSES.has(subscription.status)) {
      if (paywalledApiRoute) {
        return NextResponse.json(
          { error: 'Subscription inactive' },
          { status: 402 },
        )
      }
      if (protectedRoute) {
        return redirectTo(request, '/billing/blocked')
      }
    }
  }

  if (protectedRoute && (!venueId || !onboardingComplete)) {
    return redirectTo(request, '/onboarding')
  }

  if (onboardingRoute && venueId && onboardingComplete) {
    return redirectTo(request, '/dashboard')
  }

  return supabaseResponse
}
