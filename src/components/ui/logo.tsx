import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
}

/** Example: <Logo /> */
export function Logo({ className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2 text-text", className)} aria-label="Chalk">
      <span className="text-felt text-[18px] leading-none" aria-hidden="true">
        ◐
      </span>
      <span className="font-display text-[22px] leading-none">Chalk</span>
    </div>
  )
}
