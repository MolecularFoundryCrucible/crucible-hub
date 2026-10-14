import { describe, expect, it } from "vitest"

import {
  canOpenServiceAccountAdministration,
  canOpenUserAdministration,
  canUseAdministratorView,
} from "./administration"
import type { WorkspaceAccount } from "./workspace-source"

function account(
  overrides: Partial<WorkspaceAccount["authorization"]> & {
    is_service_account?: boolean
  } = {}
): WorkspaceAccount {
  const { is_service_account = false, ...authorization } = overrides
  return {
    authorization: {
      can_elevate: true,
      effective_privilege_mode: "normal",
      platform_role: "admin",
      ...authorization,
    },
    capabilities: {},
    email: null,
    first_name: "Avery",
    is_service_account,
    last_name: "Chen",
    unique_id: "0000-0000-0000-000X",
    username: "avery.chen",
  } as unknown as WorkspaceAccount
}

describe("administration access", () => {
  it("opens administration only while the administrator view is on", () => {
    expect(canOpenUserAdministration(account(), "normal")).toBe(false)
    expect(canOpenServiceAccountAdministration(account(), "normal")).toBe(false)
    expect(canOpenUserAdministration(account(), "elevated")).toBe(true)
    expect(canOpenServiceAccountAdministration(account(), "elevated")).toBe(
      true
    )
  })

  it("offers the administrator view only to eligible people", () => {
    expect(canUseAdministratorView(account())).toBe(true)
    expect(
      canUseAdministratorView(
        account({ can_elevate: false, platform_role: "contributor" })
      )
    ).toBe(false)
    expect(canUseAdministratorView(account({ is_service_account: true }))).toBe(
      false
    )
  })
})
