"use client"

import { cn } from "@/lib/utils"

export interface LightWavesBackgroundProps {
  className?: string
  children?: React.ReactNode
  colors?: string[]
  speed?: number
  intensity?: number
}

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!r) return { r: 255, g: 255, b: 255 }
  return { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) }
}

// Single wave cycle path (x: 0→1440) + a second copy shifted by 1440 beside it.
// The <g> animates translateX by -1440 (one full cycle), then loops back to 0 seamlessly.
function wavePaths(yPct: number, ampPct: number) {
  const H = 560
  const wy = (yPct / 100) * H
  const wa = (ampPct / 100) * H
  const p = (ox: number) =>
    `M${ox},${wy} Q${ox + 360},${wy - wa} ${ox + 720},${wy} Q${ox + 1080},${wy + wa} ${ox + 1440},${wy} L${ox + 1440},${H} L${ox},${H} Z`
  return [p(0), p(1440)]
}

const WAVE_CONFIGS = [
  { yPct: 68, ampPct: 13, durationS: 10, reverse: false },
  { yPct: 52, ampPct: 11, durationS: 14, reverse: true },
  { yPct: 80, ampPct: 10, durationS: 12, reverse: false },
]

export function LightWavesBackground({
  className,
  children,
  colors = ["#0ea5e9", "#8b5cf6", "#06b6d4", "#a855f7", "#0284c7"],
  speed = 1,
  intensity = 0.6,
}: LightWavesBackgroundProps) {
  return (
    <div className={cn("fixed inset-0 overflow-hidden bg-[#030712]", className)}>
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, #030712 0%, #0a0f1a 50%, #030712 100%)" }}
      />

      {/* Ambient glow spots */}
      {([
        { left: "15%", top: "25%", color: colors[0] },
        { left: "75%", top: "55%", color: colors[1] },
        { left: "45%", top: "70%", color: colors[2] },
      ] as const).map((spot, i) => {
        const { r, g, b } = hexToRgb(spot.color)
        return (
          <div
            key={i}
            className="pointer-events-none absolute"
            style={{
              left: spot.left,
              top: spot.top,
              width: "60vmax",
              height: "60vmax",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, rgba(${r},${g},${b},${(0.12 * intensity).toFixed(3)}) 0%, rgba(${r},${g},${b},0) 70%)`,
            }}
          />
        )
      })}

      {/* Wave layers — SVG animateTransform scrolls the path internally.
          No oversized divs or CSS keyframes needed; the SVG handles the loop. */}
      {WAVE_CONFIGS.map((cfg, i) => {
        const { r, g, b } = hexToRgb(colors[i % colors.length])
        const opacity = ((0.35 + (i / WAVE_CONFIGS.length) * 0.2) * intensity).toFixed(3)
        const dur = `${(cfg.durationS / speed).toFixed(1)}s`
        const [path1, path2] = wavePaths(cfg.yPct, cfg.ampPct)
        const from = cfg.reverse ? "-1440,0" : "0,0"
        const to = cfg.reverse ? "0,0" : "-1440,0"

        return (
          <svg
            key={i}
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 1440 560"
            preserveAspectRatio="none"
            overflow="visible"
          >
            <g>
              {/* animateTransform shifts the group by one cycle width (-1440 viewBox units = 100% CSS width)
                  then loops — the second path copy fills the gap, making the seam invisible. */}
              <animateTransform
                attributeName="transform"
                type="translate"
                from={from}
                to={to}
                dur={dur}
                repeatCount="indefinite"
              />
              <path d={path1} fill={`rgba(${r},${g},${b},${opacity})`} />
              <path d={path2} fill={`rgba(${r},${g},${b},${opacity})`} />
            </g>
          </svg>
        )
      })}

      {/* Noise texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(3,7,18,0.7) 100%)",
        }}
      />

      {children && <div className="relative z-10 h-full w-full">{children}</div>}
    </div>
  )
}
