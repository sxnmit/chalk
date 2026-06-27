// Standard pool ball colours (1–15)
const BALL_COLORS: Record<number, { bg: string; stripe?: boolean }> = {
  1: { bg: "#FFD700" },
  2: { bg: "#0000FF" },
  3: { bg: "#FF0000" },
  4: { bg: "#800080" },
  5: { bg: "#FF6600" },
  6: { bg: "#006400" },
  7: { bg: "#8B0000" },
  8: { bg: "#000000" },
  9: { bg: "#FFD700", stripe: true },
  10: { bg: "#0000FF", stripe: true },
  11: { bg: "#FF0000", stripe: true },
  12: { bg: "#800080", stripe: true },
  13: { bg: "#FF6600", stripe: true },
  14: { bg: "#006400", stripe: true },
  15: { bg: "#8B0000", stripe: true },
}

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
} as const

interface PoolBallProps {
  number: number
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

export function PoolBall({ number, size = "md", className = "" }: PoolBallProps) {
  const { bg, stripe } = BALL_COLORS[number] ?? { bg: "#FFD700" }

  return (
    <div
      className={`relative flex items-center justify-center rounded-full shadow-lg ${SIZE_CLASSES[size]} ${className}`}
      style={{
        background: stripe
          ? `linear-gradient(to bottom, white 25%, ${bg} 25%, ${bg} 75%, white 75%)`
          : bg,
        boxShadow:
          "inset -2px -2px 6px rgba(0,0,0,0.4), inset 2px 2px 6px rgba(255,255,255,0.2), 0 4px 8px rgba(0,0,0,0.3)",
      }}
    >
      {/* Number badge */}
      <div
        className="flex items-center justify-center rounded-full bg-white font-bold"
        style={{
          width: "45%",
          height: "45%",
          color: "#000",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
          fontFamily:
            '"Arial Rounded MT Bold", "Avenir Next Rounded", "Open Sans", Arial, sans-serif',
        }}
      >
        {number}
      </div>
      {/* Glare */}
      <div
        className="absolute left-1/4 top-1/4 h-2 w-2 rounded-full bg-white/30"
        style={{ filter: "blur(1px)" }}
      />
    </div>
  )
}
