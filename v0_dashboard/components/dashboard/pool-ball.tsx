"use client"

// Standard pool ball colors (1-15)
const BALL_COLORS: Record<number, { bg: string; stripe?: boolean }> = {
  1: { bg: "#FFD700" }, // Yellow (solid)
  2: { bg: "#0000FF" }, // Blue (solid)
  3: { bg: "#FF0000" }, // Red (solid)
  4: { bg: "#800080" }, // Purple (solid)
  5: { bg: "#FF6600" }, // Orange (solid)
  6: { bg: "#006400" }, // Green (solid)
  7: { bg: "#8B0000" }, // Maroon/Burgundy (solid)
  8: { bg: "#000000" }, // Black (solid)
  9: { bg: "#FFD700", stripe: true }, // Yellow (stripe)
  10: { bg: "#0000FF", stripe: true }, // Blue (stripe)
  11: { bg: "#FF0000", stripe: true }, // Red (stripe)
  12: { bg: "#800080", stripe: true }, // Purple (stripe)
  13: { bg: "#FF6600", stripe: true }, // Orange (stripe)
  14: { bg: "#006400", stripe: true }, // Green (stripe)
  15: { bg: "#8B0000", stripe: true }, // Maroon (stripe)
}

interface PoolBallProps {
  number: number
  size?: "sm" | "md" | "lg"
  className?: string
}

export function PoolBall({ number, size = "md", className = "" }: PoolBallProps) {
  const ballConfig = BALL_COLORS[number] || { bg: "#FFD700" }
  const isStripe = ballConfig.stripe
  
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg",
  }
  
  return (
    <div
      className={`relative flex items-center justify-center rounded-full shadow-lg ${sizeClasses[size]} ${className}`}
      style={{
        background: isStripe
          ? `linear-gradient(to bottom, white 25%, ${ballConfig.bg} 25%, ${ballConfig.bg} 75%, white 75%)`
          : ballConfig.bg,
        boxShadow: `inset -2px -2px 6px rgba(0,0,0,0.4), inset 2px 2px 6px rgba(255,255,255,0.2), 0 4px 8px rgba(0,0,0,0.3)`,
      }}
    >
      {/* White circle for number */}
      <div
        className="flex items-center justify-center rounded-full bg-white font-bold"
        style={{
          width: "55%",
          height: "55%",
          color: "#000",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
        }}
      >
        {number}
      </div>
      {/* Highlight/glare effect */}
      <div
        className="absolute left-1/4 top-1/4 h-2 w-2 rounded-full bg-white/50"
        style={{ filter: "blur(1px)" }}
      />
    </div>
  )
}
