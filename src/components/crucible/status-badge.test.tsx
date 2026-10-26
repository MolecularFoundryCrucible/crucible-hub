import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { StatusBadge } from "./status-badge"

describe("StatusBadge", () => {
  afterEach(cleanup)

  it("reads its label and tone from the status catalogue", () => {
    render(<StatusBadge domain="deletion-request" status="pending" />)
    const badge = screen.getByText("Pending")
    expect(badge.dataset.slot).toBe("badge")
    expect(badge.dataset.variant).toBe("warning")
  })

  it("treats statuses as resource statuses by default", () => {
    render(<StatusBadge status="decommissioned" />)
    expect(screen.getByText("Decommissioned").dataset.variant).toBe(
      "destructive"
    )
  })
})
