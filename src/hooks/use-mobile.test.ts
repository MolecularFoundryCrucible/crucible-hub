import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useIsMobile } from "./use-mobile"

const useWindowClass = vi.fn(() => "compact")
vi.mock("@/hooks/use-window-class", () => ({
  useWindowClass: () => useWindowClass(),
}))

describe("useIsMobile", () => {
  it("is true only in the compact window class", () => {
    const { rerender, result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
    useWindowClass.mockReturnValue("medium")
    rerender()
    expect(result.current).toBe(false)
  })
})
