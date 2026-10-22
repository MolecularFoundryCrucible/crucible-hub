import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useExitSafeMount } from "./use-exit-safe"

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
