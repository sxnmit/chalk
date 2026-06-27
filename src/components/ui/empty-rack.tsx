import { cn } from "@/lib/utils"

interface EmptyRackProps {
  className?: string
}

/** Example: <EmptyRack className="mx-auto" /> */
export function EmptyRack({ className }: EmptyRackProps) {
  return (
    <svg
      viewBox="0 0 140 110"
      fill="none"
      className={cn("h-auto w-[120px] text-border-strong", className)}
      aria-hidden="true"
    >
      <path
        d="M70 10 124 96H16L70 10Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {[70, 55, 85, 40, 70, 100, 25, 55, 85, 115].map((cx, index) => {
        const rows = [35, 55, 55, 75, 75, 75, 95, 95, 95, 95]
        return (
          <circle
            key={`${cx}-${index}`}
            cx={cx}
            cy={rows[index]}
            r="7"
            stroke="currentColor"
            strokeWidth="2"
          />
        )
      })}
    </svg>
  )
}
