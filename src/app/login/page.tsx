"use client"

import Image from "next/image"
import { LightWavesBackground } from "@/components/login/light-waves"
import { LoginForm } from "@/app/login/functions"

const CHALK_COLORS = ["#2a7db5", "#1e6a9e", "#3a8dc5", "#1a5a8a", "#0a4a7a"]

export default function LoginPage() {
  return (
    <LightWavesBackground colors={CHALK_COLORS} intensity={0.7}>
      {/* Logo — top left of screen */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <Image src="/logo.svg" alt="Chalk" width={200} height={72} className="h-14 sm:h-18 w-auto" style={{ width: "auto" }} />
      </div>

      <div className="flex h-full items-center justify-center p-4">
        <div className="w-[92%] max-w-[400px] bg-[rgba(10,10,10,0.45)] backdrop-blur-md border border-[0.5px] border-white/[0.08] rounded-2xl py-8 px-6 sm:py-10 sm:px-8">

          {/* Card header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-white text-xl sm:text-2xl font-semibold font-[family-name:var(--font-dm-sans)]">Welcome back</h1>
            <p className="text-white/40 text-sm mt-1">Sign in to Chalk</p>
          </div>

          <LoginForm />
        </div>
      </div>
    </LightWavesBackground>
  )
}
