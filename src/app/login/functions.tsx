"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { AvatarIcon } from "@/components/icons/radix-icons-avatar"
import { LockClosedIcon } from "@/components/icons/radix-icons-lock-closed"

const inputClass =
  "w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError("Invalid email or password. Please try again.")
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-3 bg-white/[0.06] border border-[0.5px] border-white/10 rounded-lg py-3 sm:py-[11px] px-[14px] focus-within:border-[#2a7db5] transition-colors">
        <AvatarIcon size={20} color="#2a7db5" strokeWidth={0.7} className="shrink-0" />
        <input
          id="email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-3 bg-white/[0.06] border border-[0.5px] border-white/10 rounded-lg py-3 sm:py-[11px] px-[14px] focus-within:border-[#2a7db5] transition-colors">
        <LockClosedIcon size={20} color="#2a7db5" strokeWidth={0.7} className="shrink-0" />
        <input
          id="password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full bg-[#2a7db5] hover:bg-[#3a8dc5] disabled:bg-[#1e6a9a] disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-3 sm:py-[11px] transition-colors cursor-pointer"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
      {error && (
        <p className="text-xs text-[#f87171] text-center">{error}</p>
      )}
    </form>
  )
}
