import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"

import { ManagementToggle } from "./management-toggle"

function renderToggle(active: boolean) {
  render(
    <TooltipProvider>
      <ManagementToggle
        active={active}
        onChange={() => undefined}
        subject="members"
      />
    </TooltipProvider>
  )
}

describe("ManagementToggle", () => {
  afterEach(cleanup)

  it("names itself with the word it shows", () => {
    renderToggle(false)
    const button = screen.getByRole("button", { name: "Edit members" })
    expect(button.textContent).toBe("Edit")
    expect(button.hasAttribute("data-active")).toBe(false)
  })

  it("keeps the pressed fill without reporting a pressed toggle", () => {
    renderToggle(true)
    const button = screen.getByRole("button", { name: "Done editing members" })
    expect(button.textContent).toBe("Done")
    expect(button.hasAttribute("data-active")).toBe(true)
    expect(button.hasAttribute("aria-pressed")).toBe(false)
  })
})
