import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { resolveSnapshotTime } from "@/lib/snapshot-time"

const NOW = "2026-06-28T15:00:00Z"
const SESSION_START = "2026-06-28T12:00:00Z"

describe("resolveSnapshotTime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })
  afterEach(() => vi.useRealTimers())

  it("returns current time when snapshotAt is undefined", () => {
    const result = resolveSnapshotTime(undefined, SESSION_START)
    expect(result).toEqual(new Date(NOW))
  })

  it("returns current time when snapshotAt is an invalid date string", () => {
    const result = resolveSnapshotTime("not-a-date", SESSION_START)
    expect(result).toEqual(new Date(NOW))
  })

  it("returns current time when snapshotAt is in the future", () => {
    const result = resolveSnapshotTime("2026-06-28T16:00:00Z", SESSION_START)
    expect(result).toEqual(new Date(NOW))
  })

  it("returns current time when snapshotAt is before sessionStartedAt", () => {
    const result = resolveSnapshotTime("2026-06-28T11:00:00Z", SESSION_START)
    expect(result).toEqual(new Date(NOW))
  })

  it("returns the parsed snapshot Date when valid and between session start and now", () => {
    const snapshotAt = "2026-06-28T13:30:00Z"
    const result = resolveSnapshotTime(snapshotAt, SESSION_START)
    expect(result).toEqual(new Date(snapshotAt))
  })
})
