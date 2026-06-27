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
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/billing/blocked') ||
    pathname.startsWith('/accept-invite') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/auth/accept-invite') ||
    pathname.startsWith('/api/billing/portal')
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

  const venueId =
    (user.app_metadata?.active_venue_id as string | undefined) ??
    (user.app_metadata?.venue_id as string | undefined)

  if (protectedRoute && !venueId) {
    return redirectTo(request, '/onboarding')
  }

  if (protectedRoute && venueId) {
    const { data: venue } = await supabase
      .from('venues')
      .select('onboarding_completed_at')
      .eq('id', venueId)
      .maybeSingle()

    if (!venue?.onboarding_completed_at) {
      return redirectTo(request, '/onboarding')
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('venue_id', venueId)
      .maybeSingle()

    if (!subscription) {
      return redirectTo(request, '/onboarding')
    }

    if (BLOCKED_STATUSES.has(subscription.status)) {
      return redirectTo(request, '/billing/blocked')
    }
  }

  return supabaseResponse
}
