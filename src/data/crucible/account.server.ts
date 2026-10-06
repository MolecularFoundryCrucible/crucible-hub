import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { readGlobalPrivilegeMode } from "@/server/crucible/privilege-mode.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceAccount,
  WorkspaceAccountProfileUpdate,
  WorkspaceApiCredentialStatus,
} from "./workspace-source"
import type { FixtureScenario } from "./fixture-scenarios"
import type { WorkspacePrivilegeMode } from "./privilege-mode"

export async function readWorkspaceAccount(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal,
  privilegeMode?: WorkspacePrivilegeMode
): Promise<WorkspaceAccount> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(
      scenario,
      privilegeMode ?? readGlobalPrivilegeMode()
    )
    if (source.status === "unavailable") throw new Error(source.reason)
    return source.workspace.account
  }

  const client = createCrucibleClient(configuration, { privilegeMode })
  const result = await client.GET("/account/profile", {
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }

  return toWorkspaceAccount(result.data)
}

export async function readWorkspaceAccountCredentialStatus(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceApiCredentialStatus> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario, readGlobalPrivilegeMode())
    if (source.status === "unavailable") throw new Error(source.reason)
    return {
      created_at: source.workspace.referenceTime,
      expires_at: "2027-09-01T16:00:00Z",
      valid: true,
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/account/verify", {
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return result.data
}

export async function patchWorkspaceAccount(
  changes: WorkspaceAccountProfileUpdate,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceAccount> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario, readGlobalPrivilegeMode())
    if (source.status === "unavailable") throw new Error(source.reason)
    return {
      ...source.workspace.account,
      ...changes,
      first_name: changes.first_name ?? source.workspace.account.first_name,
      last_name: changes.last_name ?? source.workspace.account.last_name,
    }
  }

  const client = createCrucibleClient(configuration)
  const result = await client.PATCH("/account/profile", {
    body: changes,
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  const account = await readWorkspaceAccount(scenario, requestSignal)
  return account
}

export async function checkWorkspaceUsernameExactMatch(
  username: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<boolean> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario, readGlobalPrivilegeMode())
    if (source.status === "unavailable") throw new Error(source.reason)
    return (
      source.workspace.account.username?.toLowerCase() ===
        username.toLowerCase() ||
      source.workspace.people.some(
        (person) => person.username?.toLowerCase() === username.toLowerCase()
      )
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/users", {
    params: { query: { username, limit: 1 } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data.items.length > 0
}

function toWorkspaceAccount(account: {
  authorization: WorkspaceAccount["authorization"]
  capabilities: WorkspaceAccount["capabilities"]
  email?: string | null
  first_name: string
  is_service_account?: boolean | null
  last_name: string
  unique_id: string
  username?: string | null
}): WorkspaceAccount {
  return {
    authorization: account.authorization,
    capabilities: account.capabilities,
    email: account.email ?? null,
    first_name: account.first_name,
    is_service_account: account.is_service_account ?? false,
    last_name: account.last_name,
    unique_id: account.unique_id,
    username: account.username ?? null,
  }
}
