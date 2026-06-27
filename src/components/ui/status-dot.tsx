import { cn } from "@/lib/utils"

interface StatusDotProps {
  number: string | number
  className?: string
}

/** Example: <StatusDot number={3} /> */
export function StatusDot({ number, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full bg-text-muted p-1",
        className
      )}
      aria-label={`Table ${number}`}
    >
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface font-mono text-xs font-medium text-text">
        {number}
      </span>
    </span>
  )
}
