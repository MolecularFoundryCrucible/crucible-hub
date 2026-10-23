import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { IdentifierInput } from "./identifier-input"

describe("IdentifierInput", () => {
  it("keeps identifiers exactly as typed", () => {
    render(<IdentifierInput aria-label="MFID" />)
    const input = screen.getByRole("textbox", { name: "MFID" })
    expect(input.getAttribute("autocapitalize")).toBe("none")
    expect(input.getAttribute("autocorrect")).toBe("off")
    expect(input.getAttribute("spellcheck")).toBe("false")
    expect(input.className).toContain("font-mono")
    expect(input.className).toContain("text-body-prominent")
  })
})
