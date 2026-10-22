import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDelayedFlag } from "./use-delayed-flag"

vi.mock("@/lib/motion", () => ({
  motionDuration: (token: string) =>
    token === "--motion-progress-delay" ? 500 : 200,
}))

describe("useDelayedFlag", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("turns on only after the delay and off immediately", () => {
    const { rerender, result } = renderHook(
      ({ active }: { active: boolean }) => useDelayedFlag(active, 200),
      { initialProps: { active: true } }
    )
    act(() => vi.advanceTimersByTime(199))
    expect(result.current).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)

    rerender({ active: false })
    expect(result.current).toBe(false)
  })

  it("never turns on when the activity ends before the delay", () => {
    const { rerender, result } = renderHook(
      ({ active }: { active: boolean }) => useDelayedFlag(active, 200),
      { initialProps: { active: true } }
    )
    act(() => vi.advanceTimersByTime(150))
    rerender({ active: false })
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe(false)
  })

  it("waits for a named motion token", () => {
    const { result } = renderHook(() =>
      useDelayedFlag(true, "--motion-progress-delay")
    )
    act(() => vi.advanceTimersByTime(499))
    expect(result.current).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
  })
})
