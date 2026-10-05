import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "@/server/crucible/client.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"

import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceAdminUser,
  WorkspaceAdminUserPage,
  WorkspaceApiCredentialStatus,
  WorkspaceAccessGroup,
  WorkspaceUserCreate,
  WorkspaceUserUpdate,
} from "./workspace-source"

type UserListInput = {
  is_service_account?: boolean
  limit: number
  offset: number
  query?: string
  scenario?: FixtureScenario
}

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

export type WorkspaceUserProject =
  Schema<"ProjectWithLead"> | Schema<"ProjectMinimalRead">

function toWorkspaceAdminUser(
  user: Schema<"UserRead"> | Schema<"UserPublicRead">
): WorkspaceAdminUser {
  return {
    email: "email" in user ? (user.email ?? null) : null,
    first_name: user.first_name,
    is_service_account: user.is_service_account ?? false,
    last_name: user.last_name,
    unique_id: user.unique_id,
    username: user.username ?? null,
  }
}

function fixtureUsers(scenario?: FixtureScenario): WorkspaceAdminUser[] {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const map = new Map<string, WorkspaceAdminUser>()
  map.set(source.workspace.account.unique_id, {
    email: source.workspace.account.email ?? "admin@lbl.gov",
    first_name: source.workspace.account.first_name,
    is_service_account: source.workspace.account.is_service_account,
    last_name: source.workspace.account.last_name,
    unique_id: source.workspace.account.unique_id,
    username: source.workspace.account.username,
  })
  for (const person of source.workspace.people) {
    if (!map.has(person.unique_id)) {
      map.set(person.unique_id, {
        email: `${person.username ?? "user"}@lbl.gov`,
        first_name: person.first_name,
        is_service_account: person.is_service_account,
        last_name: person.last_name,
        unique_id: person.unique_id,
        username: person.username ?? null,
      })
    }
  }
  return [...map.values()]
}

export async function readWorkspaceUsers(
  input: UserListInput,
  requestSignal?: AbortSignal
): Promise<WorkspaceAdminUserPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    let items = fixtureUsers(input.scenario)
    if (input.is_service_account !== undefined) {
      items = items.filter(
        (u) => Boolean(u.is_service_account) === input.is_service_account
      )
    }
    const q = input.query?.trim().toLowerCase()
    if (q) {
      items = items.filter(
        (u) =>
          u.username?.toLowerCase().includes(q) ||
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q) ||
          u.unique_id.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
      )
    }
    return {
      items: items.slice(input.offset, input.offset + input.limit),
      limit: input.limit,
      offset: input.offset,
      total: items.length,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })

  if (input.query && input.query.trim().length >= 3) {
    const result = await client.GET("/users/search", {
      params: {
        query: {
          is_service_account: input.is_service_account,
          limit: Math.min(input.limit, 50),
          q: input.query.trim(),
        },
      },
      signal: crucibleRequestSignal(requestSignal),
    })
    if (!result.data) throw new CrucibleResponseError(result.response.status)
    const mapped = result.data.map(toWorkspaceAdminUser)
    return {
      items: mapped,
      limit: input.limit,
      offset: input.offset,
      total: mapped.length,
    }
  }

  const result = await client.GET("/users", {
    params: {
      query: {
        is_service_account: input.is_service_account,
        limit: input.limit,
        offset: input.offset,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return {
    items: result.data.items.map(toWorkspaceAdminUser),
    limit: result.data.limit,
    offset: result.data.offset ?? input.offset,
    total: result.data.total ?? null,
  }
}

export async function readWorkspaceUserDetail(
  userId: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceAdminUser | null> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const user = fixtureUsers(scenario).find((u) => u.unique_id === userId)
    return user ?? null
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/users/{user_id}", {
    params: { path: { user_id: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 404) return null
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return toWorkspaceAdminUser(result.data)
}

export async function patchWorkspaceUser(
  userId: string,
  changes: WorkspaceUserUpdate,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceAdminUser> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const existing = fixtureUsers(scenario).find((u) => u.unique_id === userId)
    return {
      email:
        changes.email !== undefined ? changes.email : (existing?.email ?? null),
      first_name: changes.first_name ?? existing?.first_name ?? "Updated",
      is_service_account: existing?.is_service_account ?? false,
      last_name: changes.last_name ?? existing?.last_name ?? "User",
      unique_id: userId,
      username: changes.username ?? existing?.username ?? null,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.PATCH("/users/{user_id}", {
    body: changes,
    params: { path: { user_id: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return toWorkspaceAdminUser(result.data)
}

export async function createWorkspaceUser(
  input: WorkspaceUserCreate,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceAdminUser> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return {
      email: input.email ?? null,
      first_name: input.first_name,
      is_service_account: false,
      last_name: input.last_name,
      unique_id: input.unique_id || "0000-0000-0000-9999",
      username: input.username,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.POST("/users", {
    body: {
      project_ids: input.project_ids ? [...input.project_ids] : null,
      user_info: {
        email: input.email ?? null,
        first_name: input.first_name,
        last_name: input.last_name,
        unique_id: input.unique_id ?? null,
        username: input.username,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return toWorkspaceAdminUser(result.data)
}

export async function readWorkspaceUserApiKeyStatus(
  userId: string,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceApiCredentialStatus> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return {
      created_at: "2026-09-01T12:00:00Z",
      expires_at: "2027-09-01T12:00:00Z",
      valid: true,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/users/{user_id}/apikey/verify", {
    params: { path: { user_id: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function provisionWorkspaceUserApiKey(
  userId: string,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<{ api_key: string }> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return {
      api_key: `crucible_mock_key_${userId.slice(-6)}`,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.POST("/users/{user_id}/apikey", {
    params: { path: { user_id: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function readWorkspaceUserAccessGroups(
  userId: string,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<string[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return ["default-lab", "spectroscopy-core"]
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/users/{user_id}/access_groups", {
    params: { path: { user_id: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function addUserToAccessGroup(
  userId: string,
  groupName: string,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceAccessGroup> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return {
      group_name: groupName,
      id: 101,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.POST(
    "/users/{user_id}/access_groups/{group_name}",
    {
      params: { path: { group_name: groupName, user_id: userId } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function removeUserFromAccessGroup(
  userId: string,
  groupName: string,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<void> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.DELETE(
    "/users/{user_id}/access_groups/{group_name}",
    {
      params: { path: { group_name: groupName, user_id: userId } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.response.ok)
    throw new CrucibleResponseError(result.response.status)
}

export async function readWorkspaceUserProjects(
  userId: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceUserProject[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    return source.workspace.projects
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/users/{user_id}/projects", {
    params: { path: { user_id: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data.items
}
