"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return "Invalid email or password. Please try again."
  }

  redirect("/dashboard")
}
