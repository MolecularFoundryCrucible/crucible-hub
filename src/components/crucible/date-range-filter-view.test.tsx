import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DateRangeFilter } from "./date-range-filter"

vi.mock("@tanstack/react-router", () => ({ useHydrated: () => true }))

describe("DateRangeFilter", () => {
  afterEach(cleanup)

  it("holds the slider's place while its bounds load", () => {
    const { container } = render(
      <DateRangeFilter
        boundsPending
        idPrefix="created"
        onChange={() => undefined}
        value={{}}
      />
    )
    expect(screen.queryByRole("slider")).toBeNull()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it("puts the typed dates above the slider", () => {
    const { container } = render(
      <DateRangeFilter
        bounds={{
          earliest: "2026-08-01T12:00:00Z",
          latest: "2026-08-31T12:00:00Z",
        }}
        idPrefix="created"
        onChange={() => undefined}
        value={{}}
      />
    )
    const from = screen.getByLabelText("From")
    const start = container.querySelector('[data-slot="slider"]')!
    expect(
      from.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})
