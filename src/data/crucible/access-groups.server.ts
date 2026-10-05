import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "@/server/crucible/client.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"

import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceAccessGroup,
  WorkspaceAccessGroupMember,
} from "./workspace-source"

const fixtureGroups: WorkspaceAccessGroup[] = [
  { group_name: "spectroscopy-core", id: 1 },
  { group_name: "catalysis-lab", id: 2 },
  { group_name: "surface-science", id: 3 },
  { group_name: "automation-ops", id: 4 },
  { group_name: "default-lab", id: 5 },
]

export async function readWorkspaceAccessGroups(
  _scenario?: FixtureScenario,
  _requestSignal?: AbortSignal
): Promise<readonly WorkspaceAccessGroup[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  return fixtureGroups
}

export async function readWorkspaceAccessGroup(
  groupName: string,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceAccessGroup | null> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const group = fixtureGroups.find((g) => g.group_name === groupName)
    return group ?? { group_name: groupName, id: 999 }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/access_groups/{group_name}", {
    params: { path: { group_name: groupName } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 404) return null
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function createWorkspaceAccessGroup(
  input: { group_name: string },
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceAccessGroup> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return {
      group_name: input.group_name,
      id: fixtureGroups.length + 1,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.POST("/access_groups", {
    body: { group_name: input.group_name },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function readWorkspaceAccessGroupUsers(
  groupName: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceAccessGroupMember[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    return [
      {
        first_name: source.workspace.account.first_name,
        is_service_account: source.workspace.account.is_service_account,
        last_name: source.workspace.account.last_name,
        role: "admin",
        unique_id: source.workspace.account.unique_id,
        username: source.workspace.account.username,
      },
      ...source.workspace.people.slice(0, 3).map((person) => ({
        first_name: person.first_name,
        is_service_account: person.is_service_account,
        last_name: person.last_name,
        role: "member",
        unique_id: person.unique_id,
        username: person.username ?? null,
      })),
    ]
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/access_groups/{group_name}/users", {
    params: { path: { group_name: groupName } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}
