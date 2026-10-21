import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiCredentialCard, ApiKeyStatusBadge } from "./api-credential-card"

afterEach(cleanup)

const fields = [
  "Last active",
  "Key last used",
  "Key status",
  "Key created",
  "Key expires",
]

function expectAllFields() {
  for (const field of fields) expect(screen.getByText(field)).toBeTruthy()
}

describe("ApiCredentialCard", () => {
  it("keeps the field layout when the account has no key", () => {
    render(<ApiCredentialCard lastActiveAt={null} status={null} />)

    expect(screen.getByText("Security")).toBeTruthy()
    expectAllFields()
    expect(screen.getByText("No key")).toBeTruthy()
    expect(screen.getByText("Never")).toBeTruthy()
  })

  it("keeps the field layout and offers a retry when status fails", () => {
    const onRetry = vi.fn()
    render(
      <ApiCredentialCard
        error="The API key status could not be loaded."
        lastActiveAt={null}
        onRetry={onRetry}
      />
    )

    expectAllFields()
    expect(screen.queryByText("No key")).toBeNull()
    expect(screen.getByRole("alert").textContent).toBe(
      "The API key status could not be loaded."
    )
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

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
