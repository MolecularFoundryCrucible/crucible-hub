import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { HubApiClientError } from "@/data/crucible/result"

import { PlatformRoleDialog } from "./platform-role-dialog"

vi.mock("@/components/crucible/notifications", () => ({
  notifySuccess: vi.fn(),
}))

const roleDescriptions = {
  admin: "Full platform administration.",
  contributor: "Platform-wide read and create access.",
  none: "No platform-wide role.",
}

function renderDialog(onChange: () => Promise<unknown>) {
  const onOpenChange = vi.fn()
  render(
    <PlatformRoleDialog
      currentRole="contributor"
      id="platform-role"
      onChange={onChange}
      onOpenChange={onOpenChange}
      open
      roleDescriptions={roleDescriptions}
    />
  )
  fireEvent.change(screen.getByLabelText("Platform role"), {
    target: { value: "admin" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Change role" }))
  return { onOpenChange }
}

describe("PlatformRoleDialog", () => {
  afterEach(cleanup)

  it("asks for a recent sign-in and stays open when the API requires one", async () => {
    const { onOpenChange } = renderDialog(() =>
      Promise.reject(
        new HubApiClientError({
          correlationId: "step-up",
          kind: "reauthentication-required",
          message: "Sign in again to continue.",
          retryable: false,
        })
      )
    )

    expect(
      await screen.findByText(/Changing this role needs a recent sign-in\./)
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /Sign in with ORCID/ })
    ).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("shows the fallback message for other failures", async () => {
    renderDialog(() => Promise.reject(new Error("network")))

    expect(
      await screen.findByText("The platform role could not be changed.")
    ).toBeTruthy()
  })
})
