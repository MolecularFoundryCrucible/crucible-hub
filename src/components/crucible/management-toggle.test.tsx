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

  it("names itself with the word it shows without reporting a pressed toggle", () => {
    renderToggle(false)
    const edit = screen.getByRole("button", { name: "Edit members" })
    expect(edit.textContent).toBe("Edit")
    expect(edit.hasAttribute("data-active")).toBe(false)
    cleanup()

    renderToggle(true)
    const done = screen.getByRole("button", { name: "Done editing members" })
    expect(done.textContent).toBe("Done")
    expect(done.hasAttribute("data-active")).toBe(true)
    expect(done.hasAttribute("aria-pressed")).toBe(false)
  })
})
