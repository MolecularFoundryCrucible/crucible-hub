import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  isWindowClass,
  windowClassAtLeast,
  windowClassBreakpoints,
  windowClassForMatches,
} from "./window-class"

describe("window classes", () => {
  it("match the breakpoint tokens in styles.css", () => {
    const css = readFileSync("src/styles.css", "utf8")
    const token = (name: string) =>
      new RegExp(`--breakpoint-${name}:\\s*([^;]+);`).exec(css)?.[1]
    expect(token("md")).toBe(windowClassBreakpoints.medium)
    expect(token("lg")).toBe(windowClassBreakpoints.expanded)
    expect(token("wide")).toBe(windowClassBreakpoints.wide)
  })

  it("resolves the widest matching class", () => {
    const none = { expanded: false, medium: false, wide: false }
    expect(windowClassForMatches(none)).toBe("compact")
    expect(windowClassForMatches({ ...none, medium: true })).toBe("medium")
    expect(
      windowClassForMatches({ expanded: true, medium: true, wide: false })
    ).toBe("expanded")
    expect(
      windowClassForMatches({ expanded: true, medium: true, wide: true })
    ).toBe("wide")
  })

  it("orders classes and validates cookie values", () => {
    expect(windowClassAtLeast("wide", "expanded")).toBe(true)
    expect(windowClassAtLeast("medium", "expanded")).toBe(false)
    expect(isWindowClass("medium")).toBe(true)
    expect(isWindowClass("tablet")).toBe(false)
  })
})
