"use client"

import { useActionState } from "react"
import { AvatarIcon } from "@/components/icons/radix-icons-avatar"
import { LockClosedIcon } from "@/components/icons/radix-icons-lock-closed"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginAction } from "./actions"

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(loginAction, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="space-y-2">
        <span className="text-caption text-text-muted">Email</span>
        <div className="relative">
          <AvatarIcon
            size={20}
            color="currentColor"
            strokeWidth={0.7}
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-chalk"
          />
          <Input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="pl-10"
          />
        </div>
      </label>
      <label className="space-y-2">
        <span className="text-caption text-text-muted">Password</span>
        <div className="relative">
          <LockClosedIcon
            size={20}
            color="currentColor"
            strokeWidth={0.7}
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-chalk"
          />
          <Input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="pl-10"
          />
        </div>
      </label>
      <Button type="submit" loading={isPending} className="mt-2 w-full">
        Sign in
      </Button>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </form>
  )
}
