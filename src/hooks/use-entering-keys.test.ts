import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useEnteringKeys } from "./use-entering-keys"

describe("useEnteringKeys", () => {
  it("marks only keys that arrive after the first render", () => {
    const { rerender, result } = renderHook(
      ({ keys }: { keys: string[] }) => useEnteringKeys(keys),
      { initialProps: { keys: ["a", "b"] } }
    )
    expect([...result.current]).toEqual([])

    rerender({ keys: ["c", "a"] })
    expect([...result.current]).toEqual(["c"])

    rerender({ keys: ["c", "a"] })
    expect([...result.current]).toEqual([])
  })
})
