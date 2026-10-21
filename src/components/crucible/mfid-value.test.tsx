import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"

import { CopyMfidButton } from "./mfid-value"

describe("CopyMfidButton", () => {
  afterEach(cleanup)

  it("stays compact inline and grows to the standalone icon size on request", () => {
    render(
      <TooltipProvider>
        <CopyMfidButton value="01J6Y8N4Q2R7M9K3T5V0W1X2Z9" />
        <CopyMfidButton size="icon-sm" value="01J6Y8N4Q2R7M9K3T5V0W1X2Z9" />
      </TooltipProvider>
    )

    const [inline, standalone] = screen.getAllByRole("button", {
      name: "Copy MFID",
    })
    expect(inline.className).toContain("size-6")
    expect(standalone.className).toContain("size-7")
  })
})
