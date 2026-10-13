import { describe, expect, it } from "vitest"

import { createTransferRate, formatDuration } from "./transfer-rate"

describe("transfer rate", () => {
  it("waits for enough samples before estimating", () => {
    const rate = createTransferRate()
    expect(rate.update(100, 1000, 0)).toBeUndefined()
    expect(rate.update(200, 1000, 1000)).toBeUndefined()
    expect(rate.update(300, 1000, 2000)).toEqual({
      bytesPerSecond: 100,
      secondsRemaining: 7,
    })
  })

  it("starts timing at the first transferred byte", () => {
    const rate = createTransferRate()
    expect(rate.update(0, 1000, 0)).toBeUndefined()
    expect(rate.update(0, 1000, 5000)).toBeUndefined()
    expect(rate.update(100, 1000, 6000)).toBeUndefined()
    expect(rate.update(300, 1000, 8000)?.bytesPerSecond).toBe(100)
  })

  it("smooths changes in throughput", () => {
    const rate = createTransferRate(1000)
    rate.update(1000, 10_000, 0)
    rate.update(2000, 10_000, 1000)
    const estimate = rate.update(5000, 10_000, 2000)
    expect(estimate?.bytesPerSecond).toBeGreaterThan(1000)
    expect(estimate?.bytesPerSecond).toBeLessThan(3000)
  })

  it("formats remaining time", () => {
    expect(formatDuration(0.2)).toBe("1 s")
    expect(formatDuration(42)).toBe("42 s")
    expect(formatDuration(150)).toBe("3 min")
    expect(formatDuration(3900)).toBe("1 h 5 min")
  })
})
