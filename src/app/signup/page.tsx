"use client"

import Image from "next/image"
import Link from "next/link"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MailCheck } from "lucide-react"
import { AvatarIcon } from "@/components/icons/radix-icons-avatar"
import { EnvelopeClosedIcon } from "@/components/icons/radix-icons-envelope-closed"
import { LockClosedIcon } from "@/components/icons/radix-icons-lock-closed"
import { LightWavesBackground } from "@/components/login/light-waves"
import { createClient } from "@/utils/supabase/client"

const CHALK_COLORS = ["#2a7db5", "#1e6a9e", "#3a8dc5", "#1a5a8a", "#0a4a7a"]
const inputClass =
  "w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("token")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const nextPath = inviteToken
    ? `/accept-invite?token=${encodeURIComponent(inviteToken)}`
    : "/onboarding"

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
        : undefined

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: redirectTo,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // When email confirmation is enabled in Supabase, signUp does not return
    // a session — the user has to click the link in the confirmation email
    // before they're authenticated. Show a "check your email" screen instead
    // of pushing them into onboarding where every API call would 401.
    if (!data.session) {
      setConfirmationSent(true)
      setLoading(false)
      return
    }

    router.push(nextPath)
  }

  if (confirmationSent) {
    return (
      <div className="w-[92%] max-w-[420px] rounded-2xl border border-white/[0.08] bg-[rgba(10,10,10,0.45)] px-6 py-8 backdrop-blur-md sm:px-8 sm:py-10">
        <MailCheck className="mb-4 h-10 w-10 text-primary" />
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Check your email</h1>
        <p className="mt-2 text-sm text-white/60">
          We sent a confirmation link to <span className="text-white">{email}</span>. Click it to
          verify your address and continue setting up your venue.
        </p>
        <p className="mt-4 text-xs text-white/40">
          The link will bring you back here and drop you straight into onboarding. You can close
          this tab in the meantime.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="w-[92%] max-w-[420px] rounded-2xl border border-white/[0.08] bg-[rgba(10,10,10,0.45)] px-6 py-8 backdrop-blur-md sm:px-8 sm:py-10"
    >
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Create your account</h1>
        <p className="mt-1 text-sm text-white/40">Start your Chalk trial</p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-[0.5px] border-white/10 bg-white/[0.06] px-[14px] py-3 transition-colors focus-within:border-primary sm:py-[11px]">
          <AvatarIcon size={20} color="var(--color-primary)" strokeWidth={0.7} className="shrink-0" />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            required
            className={inputClass}
          />
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-[0.5px] border-white/10 bg-white/[0.06] px-[14px] py-3 transition-colors focus-within:border-primary sm:py-[11px]">
          <EnvelopeClosedIcon size={20} color="var(--color-primary)" strokeWidth={0.7} className="shrink-0" />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
            className={inputClass}
          />
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-[0.5px] border-white/10 bg-white/[0.06] px-[14px] py-3 transition-colors focus-within:border-primary sm:py-[11px]">
          <LockClosedIcon size={20} color="var(--color-primary)" strokeWidth={0.7} className="shrink-0" />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            minLength={8}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full cursor-pointer rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-primary/40 sm:py-[11px]"
        >
          {loading ? "Creating..." : "Create account"}
        </button>
        {error && <p className="text-center text-xs text-[#f87171]">{error}</p>}
      </div>
      <p className="mt-6 text-center text-sm text-white/45">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary/80">
          Sign in
        </Link>
      </p>
    </form>
  )
}

export default function SignupPage() {
  return (
    <LightWavesBackground colors={CHALK_COLORS} intensity={0.7}>
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <Image src="/logo.png" alt="Chalk" width={200} height={72} className="h-14 w-auto sm:h-18" />
      </div>
      <div className="flex h-full items-center justify-center p-4">
        <Suspense fallback={
          <div className="w-[92%] max-w-[420px] rounded-2xl border border-white/[0.08] bg-[rgba(10,10,10,0.45)] px-6 py-8 backdrop-blur-md sm:px-8 sm:py-10">
            <div className="h-40 animate-pulse rounded-lg bg-white/5" />
          </div>
        }>
          <SignupForm />
        </Suspense>
      </div>
    </LightWavesBackground>
  )
}
