"use client"

import Image from "next/image"
import Link from "next/link"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LightWavesBackground } from "@/components/login/light-waves"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/client"

const CHALK_COLORS = ["#2a7db5", "#1e6a9e", "#3a8dc5", "#1a5a8a", "#0a4a7a"]

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("token")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    router.push(inviteToken ? `/accept-invite?token=${encodeURIComponent(inviteToken)}` : "/onboarding")
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
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-white/80">Name</Label>
          <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/80">Email</Label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/80">Password</Label>
          <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
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
