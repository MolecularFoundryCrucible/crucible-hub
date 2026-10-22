import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { PendingRegion } from "./pending-region"

afterEach(cleanup)

describe("PendingRegion", () => {
  it("marks a pending region busy and dimmable", () => {
    const { rerender } = render(
      <PendingRegion pending>
        <p>Rows</p>
      </PendingRegion>
    )
    const region = screen.getByText("Rows").parentElement!
    expect(region.className).toContain("pending-region")
    expect(region.hasAttribute("data-pending")).toBe(true)
    expect(region.getAttribute("aria-busy")).toBe("true")

    rerender(
      <PendingRegion pending={false}>
        <p>Rows</p>
      </PendingRegion>
    )
    expect(region.hasAttribute("data-pending")).toBe(false)
    expect(region.hasAttribute("aria-busy")).toBe(false)
  })
})
