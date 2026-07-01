"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { MailCheck } from "lucide-react"
import { EnvelopeClosedIcon } from "@/components/icons/radix-icons-envelope-closed"
import { LightWavesBackground } from "@/components/login/light-waves"
import { createClient } from "@/utils/supabase/client"

const CHALK_COLORS = ["#2a7db5", "#1e6a9e", "#3a8dc5", "#1a5a8a", "#0a4a7a"]
const inputClass =
  "w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`
        : undefined

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    )

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <LightWavesBackground colors={CHALK_COLORS} intensity={0.7}>
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <Image src="/logo.png" alt="Chalk" width={200} height={72} className="h-14 w-auto sm:h-18" />
      </div>
      <div className="flex h-full items-center justify-center p-4">
        <div className="w-[92%] max-w-[400px] rounded-2xl border border-[0.5px] border-white/[0.08] bg-[rgba(10,10,10,0.45)] px-6 py-8 backdrop-blur-md sm:px-8 sm:py-10">
          {sent ? (
            <>
              <MailCheck className="mb-4 h-10 w-10 text-primary" />
              <h1 className="text-xl font-semibold text-white sm:text-2xl">Check your email</h1>
              <p className="mt-2 text-sm text-white/60">
                We sent a password reset link to <span className="text-white">{email}</span>.
              </p>
              <p className="mt-6 text-center text-sm text-white/45">
                <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary/80">
                  Back to sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-white sm:text-2xl">Reset your password</h1>
                <p className="mt-1 text-sm text-white/40">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>
              <form onSubmit={submit} className="flex flex-col gap-3">
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
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full cursor-pointer rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-primary/40 sm:py-[11px]"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
                {error && <p className="text-center text-xs text-[#f87171]">{error}</p>}
              </form>
              <p className="mt-6 text-center text-sm text-white/45">
                Remember your password?{" "}
                <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary/80">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </LightWavesBackground>
  )
}
