import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "./collection-state"

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  motionDuration: () => 200,
}))

afterEach(cleanup)

describe("CollectionUpdateError", () => {
  it("names a failed refresh and retries it", () => {
    const retry = vi.fn()

    render(<CollectionUpdateError label="Projects" preserved retry={retry} />)

    expect(screen.getByRole("alert").textContent).toContain(
      "Projects could not be refreshed"
    )
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalledOnce()
  })
})

describe("CollectionUpdateStatus", () => {
  it("renders an empty live region until hydration so markup matches", () => {
    const html = renderToString(
      <CollectionUpdateStatus label="datasets" updating />
    )
    expect(html).toContain('role="status"')
    expect(html).not.toContain("Updating")
  })

  it("announces only updates that outlast the indicator delay", () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(
        <CollectionUpdateStatus label="datasets" updating />
      )
      expect(screen.getByRole("status").textContent).toBe("")

      act(() => vi.advanceTimersByTime(200))
      expect(screen.getByRole("status").textContent).toBe("Updating datasets…")

      rerender(<CollectionUpdateStatus label="datasets" updating={false} />)
      expect(screen.getByRole("status").textContent).toBe("")
    } finally {
      vi.useRealTimers()
    }
  })
})
