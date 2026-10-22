import { afterEach, describe, expect, it, vi } from "vitest"

import { motionDuration, parseCssTime } from "./motion"

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
        name === "--motion-standard" ? value : "",
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
})
