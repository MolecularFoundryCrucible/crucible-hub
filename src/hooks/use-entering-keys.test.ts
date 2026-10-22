import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { enterMotionClassName } from "@/lib/motion"

import { useEnteringClassName, useEnteringKeys } from "./use-entering-keys"

describe("useEnteringKeys", () => {
  it("marks only keys that arrive after the first render", () => {
    const { rerender, result } = renderHook(
      ({ keys }: { keys: string[] }) => useEnteringKeys(keys),
      { initialProps: { keys: ["a", "b"] } }
    )
    expect([...result.current]).toEqual([])

    rerender({ keys: ["c", "a"] })
    expect([...result.current]).toEqual(["c"])

    rerender({ keys: ["d", "c", "a"] })
    expect([...result.current]).toEqual(["d"])
  })

  it("keeps new keys entering through unrelated re-renders", () => {
    const { rerender, result } = renderHook(
      ({ keys }: { keys: string[] }) => useEnteringKeys(keys),
      { initialProps: { keys: ["a"] } }
    )
    rerender({ keys: ["a", "b"] })
    rerender({ keys: ["a", "b"] })
    rerender({ keys: ["a", "b"] })
    expect([...result.current]).toEqual(["b"])
  })
})

describe("useEnteringClassName", () => {
  it("gives the enter motion class only to arriving keys", () => {
    const { rerender, result } = renderHook(
      ({ keys }: { keys: string[] }) => useEnteringClassName(keys),
      { initialProps: { keys: ["a"] } }
    )
    expect(result.current("a")).toBeUndefined()
    rerender({ keys: ["a", "b"] })
    expect(result.current("a")).toBeUndefined()
    expect(result.current("b")).toBe(enterMotionClassName)
  })
})
