import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useExitSafeMount, useLastPresent } from "./use-exit-safe"

describe("useExitSafeMount", () => {
  it("stays mounted after closing until the close animation completes", () => {
    const { rerender, result } = renderHook(
      ({ open }: { open: boolean }) => useExitSafeMount(open),
      { initialProps: { open: false } }
    )
    expect(result.current.mounted).toBe(false)

    rerender({ open: true })
    expect(result.current.mounted).toBe(true)

    rerender({ open: false })
    expect(result.current.mounted).toBe(true)

    act(() => result.current.onOpenChangeComplete(false))
    expect(result.current.mounted).toBe(false)
  })
})

describe("useLastPresent", () => {
  it("keeps the last value while it becomes empty", () => {
    const { rerender, result } = renderHook(
      ({ value }: { value: string | undefined }) => useLastPresent(value),
      { initialProps: { value: undefined as string | undefined } }
    )
    expect(result.current).toBeUndefined()
    rerender({ value: "key-1" })
    expect(result.current).toBe("key-1")
    rerender({ value: undefined })
    expect(result.current).toBe("key-1")
  })
})
