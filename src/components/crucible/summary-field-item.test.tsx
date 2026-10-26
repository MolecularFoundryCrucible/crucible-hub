import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { SummaryFieldItem } from "./summary-field-icon"

describe("SummaryFieldItem", () => {
  afterEach(cleanup)

  it("pairs a label with an icon and a wrapping value", () => {
    render(
      <dl>
        <SummaryFieldItem
          className="col-span-2"
          icon={<svg data-testid="icon" />}
          label="Organization"
        >
          Molecular Foundry
        </SummaryFieldItem>
      </dl>
    )
    const term = screen.getByText("Organization")
    const value = term.nextElementSibling as HTMLElement
    expect(term.tagName).toBe("DT")
    expect(value.tagName).toBe("DD")
    expect(value.className).toContain("break-words")
    expect(value.firstElementChild).toBe(screen.getByTestId("icon"))
    expect(value.textContent).toBe("Molecular Foundry")
    expect(term.parentElement!.className).toBe("min-w-0 col-span-2")
  })
})
