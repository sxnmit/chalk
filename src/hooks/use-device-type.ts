"use client"

import { useEffect, useState } from "react"

export type DeviceType = "mobile" | "tablet" | "desktop"

const BREAKPOINTS = { mobile: 640, tablet: 1024 }

function classify(width: number): DeviceType {
  if (width < BREAKPOINTS.mobile) return "mobile"
  if (width < BREAKPOINTS.tablet) return "tablet"
  return "desktop"
}

export function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>("desktop")

  useEffect(() => {
    function update() {
      setDevice(classify(window.innerWidth))
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return device
}
