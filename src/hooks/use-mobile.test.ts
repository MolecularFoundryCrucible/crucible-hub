import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useIsMobile } from "./use-mobile"

const useMediaQuery = vi.fn((_query: string) => true)
vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: (query: string) => useMediaQuery(query),
}))

describe("useIsMobile", () => {
  it("follows the compact breakpoint in rem", () => {
    const { result } = renderHook(() => useIsMobile())
    expect(useMediaQuery).toHaveBeenCalledWith("(width < 48rem)")
    expect(result.current).toBe(true)
  })
})
