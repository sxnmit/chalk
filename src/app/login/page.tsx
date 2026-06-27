"use client"

import { LoginForm } from "@/app/login/functions"
import { Logo } from "@/components/ui/logo"

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col px-4 py-6 sm:px-6 lg:px-8">
        <Logo />

        <div className="flex flex-1 items-center justify-center py-12">
          <section className="w-full max-w-[400px] rounded-lg border border-border bg-surface p-6 sm:p-8">
            <div className="mb-8">
              <h1 className="text-h1 text-text">Welcome back</h1>
              <p className="mt-1 text-body-sm text-text-muted">Sign in to Chalk</p>
            </div>

            <LoginForm />
          </section>
        </div>
      </div>
    </main>
  )
}
