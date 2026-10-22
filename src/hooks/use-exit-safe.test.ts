import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useExitSafeMount, useExitSafeValue } from "./use-exit-safe"

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

describe("useExitSafeValue", () => {
  const initialProps: { value: string | undefined } = { value: "request-1" }

  it("keeps the last value until the close animation completes", () => {
    const { rerender, result } = renderHook(
      ({ value }: { value: string | undefined }) => useExitSafeValue(value),
      { initialProps }
    )
    expect(result.current.value).toBe("request-1")

    rerender({ value: undefined })
    expect(result.current.value).toBe("request-1")

    act(() => result.current.onOpenChangeComplete(false))
    expect(result.current.value).toBeUndefined()
  })

  it("shows a new value immediately", () => {
    const { rerender, result } = renderHook(
      ({ value }: { value: string | undefined }) => useExitSafeValue(value),
      { initialProps }
    )
    rerender({ value: "request-2" })
    expect(result.current.value).toBe("request-2")
  })
})
