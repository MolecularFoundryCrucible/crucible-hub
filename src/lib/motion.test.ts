import { afterEach, describe, expect, it, vi } from "vitest"

import { cubicBezier, motionDuration, parseCssTime } from "./motion"

describe("parseCssTime", () => {
  it("reads milliseconds and seconds, as minified CSS may write them", () => {
    expect(parseCssTime("180ms")).toBe(180)
    expect(parseCssTime(".18s")).toBe(180)
    expect(parseCssTime(" 0.24s ")).toBe(240)
    expect(parseCssTime("")).toBe(0)
    expect(parseCssTime("fast")).toBe(0)
  })
})

describe("motionDuration", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function stubMotion(value: string, reduced: boolean) {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) =>
        name === "--motion-standard" || name === "--motion-indicator-delay"
          ? value
          : "",
    } as CSSStyleDeclaration)
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced }))
    )
  }

  it("returns the token in milliseconds", () => {
    stubMotion(".18s", false)
    expect(motionDuration("--motion-standard")).toBe(180)
  })

  it("returns zero under reduced motion", () => {
    stubMotion("180ms", true)
    expect(motionDuration("--motion-standard")).toBe(0)
  })

  it("keeps the indicator delay under reduced motion", () => {
    stubMotion("200ms", true)
    expect(motionDuration("--motion-indicator-delay")).toBe(200)
  })
})

describe("cubicBezier", () => {
  it("evaluates CSS cubic-bezier curves", () => {
    const linear = cubicBezier("cubic-bezier(0, 0, 1, 1)")
    expect(linear(0.5)).toBeCloseTo(0.5, 3)
    const ease = cubicBezier("cubic-bezier(0.25, 0.1, 0.25, 1)")
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(0.5)).toBeCloseTo(0.8024, 3)
  })

  it("falls back to linear for anything else", () => {
    expect(cubicBezier("steps(4)")(0.3)).toBe(0.3)
  })
})
