import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/utils/supabase/server"

// Supabase email-confirmation links (signup, magic link, recovery) point at
// this route with either `?code=...` (PKCE) or `?token_hash=...&type=...`
// (OTP). We exchange whichever is present for a session, then forward to
// `next` (defaults to /onboarding so brand-new owners land in the venue flow).
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as
    | "signup"
    | "invite"
    | "magiclink"
    | "recovery"
    | "email_change"
    | "email"
    | null
  const next = url.searchParams.get("next") || "/onboarding"

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url),
      )
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url),
      )
    }
  } else {
    return NextResponse.redirect(new URL("/login", url))
  }

  // Only allow same-origin redirects so a tampered link can't bounce the
  // freshly-authenticated user to an attacker-controlled URL.
  const redirectPath = next.startsWith("/") ? next : "/onboarding"
  return NextResponse.redirect(new URL(redirectPath, url))
}
