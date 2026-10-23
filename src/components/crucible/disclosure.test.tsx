import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Disclosure, DisclosureSummary } from "./disclosure"

describe("Disclosure", () => {
  it("renders a native disclosure with a decorative chevron", () => {
    const { container } = render(
      <Disclosure>
        <DisclosureSummary>
          <span>Diagnostic payload</span>
        </DisclosureSummary>
        <p>Details</p>
      </Disclosure>
    )
    const summary = screen.getByText("Diagnostic payload").closest("summary")!
    expect(summary.parentElement?.tagName).toBe("DETAILS")
    expect(summary.parentElement?.className).toContain("disclosure")
    expect(
      container.querySelector(".disclosure-icon")?.getAttribute("aria-hidden")
    ).toBe("true")
  })
})
