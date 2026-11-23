import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ApiKeyStatusBadge } from "./api-credential-card"

afterEach(cleanup)

describe("ApiKeyStatusBadge", () => {
  it("names a missing, valid, or invalid key", () => {
    const status = {
      created_at: "2026-09-01T12:00:00Z",
      expires_at: "2027-09-01T12:00:00Z",
      last_used_at: null,
    }
    const { rerender } = render(<ApiKeyStatusBadge status={null} />)
    expect(screen.getByText("No key")).toBeTruthy()
    rerender(<ApiKeyStatusBadge status={{ ...status, valid: true }} />)
    expect(screen.getByText("Valid")).toBeTruthy()
    rerender(<ApiKeyStatusBadge status={{ ...status, valid: false }} />)
    expect(screen.getByText("Invalid")).toBeTruthy()
  })
})
