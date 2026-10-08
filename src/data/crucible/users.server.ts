import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "@/server/crucible/client.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"

import type { FixtureScenario } from "./fixture-scenarios"
import { fixtureCursorPage } from "./pagination"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceAdminUser,
  WorkspaceAdminUserPage,
  WorkspaceUserCreate,
  WorkspaceUserPlatformRole,
  WorkspaceUserSort,
  WorkspaceUserUpdate,
} from "./workspace-source"

type UserListInput = {
  cursor?: string
  direction?: "asc" | "desc"
  includeTotal?: boolean
  is_service_account?: boolean
  limit: number
  query?: string
  scenario?: FixtureScenario
  sort?: WorkspaceUserSort
}

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

function toWorkspaceAdminUser(
  user: Schema<"UserRead"> | Schema<"UserPublicRead">
): WorkspaceAdminUser {
  return {
    api_key_status:
      "api_key_status" in user ? (user.api_key_status ?? null) : null,
    email: "email" in user ? (user.email ?? null) : null,
    first_name: user.first_name,
    is_service_account: user.is_service_account ?? false,
    last_name: user.last_name,
    platform_role:
      "platform_role" in user && typeof user.platform_role === "string"
        ? user.platform_role
        : null,
    unique_id: user.unique_id,
    user_capabilities:
      "user_capabilities" in user && user.user_capabilities
        ? user.user_capabilities
        : null,
    username: user.username ?? null,
  }
}

const fixtureUserCapabilities = {
  can_change_platform_role: true,
  can_edit_profile: true,
  can_manage_api_key: true,
  can_view_private: true,
} satisfies components["schemas"]["UserCapabilities"]

const fixtureApiKeyStatus = {
  created_at: "2026-09-01T12:00:00Z",
  expires_at: "2027-09-01T12:00:00Z",
  valid: true,
} satisfies components["schemas"]["ServiceAccountKeyStatus"]

function fixtureUsers(scenario?: FixtureScenario): WorkspaceAdminUser[] {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const map = new Map<string, WorkspaceAdminUser>()
  map.set(source.workspace.account.unique_id, {
    api_key_status: fixtureApiKeyStatus,
    email: source.workspace.account.email ?? "admin@lbl.gov",
    first_name: source.workspace.account.first_name,
    is_service_account: source.workspace.account.is_service_account,
    last_name: source.workspace.account.last_name,
    platform_role: source.workspace.account.authorization.platform_role,
    unique_id: source.workspace.account.unique_id,
    user_capabilities: fixtureUserCapabilities,
    username: source.workspace.account.username,
  })
  for (const person of source.workspace.people) {
    if (!map.has(person.unique_id)) {
      map.set(person.unique_id, {
        api_key_status: fixtureApiKeyStatus,
        email: `${person.username ?? "user"}@lbl.gov`,
        first_name: person.first_name,
        is_service_account: person.is_service_account,
        last_name: person.last_name,
        platform_role: null,
        unique_id: person.unique_id,
        user_capabilities: fixtureUserCapabilities,
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
    items = sortFixtureUsers(items, input.sort, input.direction)
    const page = fixtureCursorPage(items, {
      cursor: input.cursor,
      limit: input.limit,
    })
    return input.includeTotal === false ? { ...page, total: null } : page
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/users", {
    params: {
      query: {
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        direction: input.direction,
        include_total: input.includeTotal,
        is_service_account: input.is_service_account,
        limit: input.limit,
        q: input.query,
        sort: input.sort,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return {
    items: result.data.items.map(toWorkspaceAdminUser),
    limit: result.data.limit,
    nextCursor: result.data.next_cursor ?? null,
    total: result.data.total ?? null,
  }
}

function sortFixtureUsers(
  items: WorkspaceAdminUser[],
  sort: WorkspaceUserSort | undefined,
  direction: "asc" | "desc" | undefined
): WorkspaceAdminUser[] {
  if (!sort) return items
  const sorted = [...items].sort((a, b) => {
    let comparison = 0
    if (sort === "name") {
      comparison = `${a.first_name} ${a.last_name}`
        .trim()
        .localeCompare(`${b.first_name} ${b.last_name}`.trim())
    } else if (sort === "unique_id") {
      comparison = a.unique_id.localeCompare(b.unique_id)
    } else if (sort === "email") {
      comparison = (a.email ?? "").localeCompare(b.email ?? "")
    } else {
      comparison = (a.username ?? "").localeCompare(b.username ?? "")
    }
    return direction === "desc" ? -comparison : comparison
  })
  return sorted
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
  const result = await client.GET("/users/{user_ref}", {
    params: { path: { user_ref: userId } },
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
      api_key_status: existing?.api_key_status ?? null,
      email:
        changes.email !== undefined ? changes.email : (existing?.email ?? null),
      first_name: changes.first_name ?? existing?.first_name ?? "Updated",
      is_service_account: existing?.is_service_account ?? false,
      last_name: changes.last_name ?? existing?.last_name ?? "User",
      platform_role: existing?.platform_role ?? null,
      unique_id: userId,
      user_capabilities: existing?.user_capabilities ?? fixtureUserCapabilities,
      username: changes.username ?? existing?.username ?? null,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.PATCH("/users/{user_ref}", {
    body: changes,
    params: { path: { user_ref: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return toWorkspaceAdminUser(result.data)
}

export async function updateWorkspaceUserPlatformRole(
  userId: string,
  platformRole: WorkspaceUserPlatformRole,
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
      api_key_status: existing?.api_key_status ?? null,
      email: existing?.email ?? null,
      first_name: existing?.first_name ?? "Updated",
      is_service_account: existing?.is_service_account ?? false,
      last_name: existing?.last_name ?? "User",
      platform_role: platformRole,
      unique_id: userId,
      user_capabilities: existing?.user_capabilities ?? fixtureUserCapabilities,
      username: existing?.username ?? null,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.PATCH("/users/{user_ref}/platform_role", {
    body: { platform_role: platformRole },
    params: { path: { user_ref: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return toWorkspaceAdminUser(result.data)
}

export async function revokeWorkspaceUserApiKey(
  userId: string,
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
  const result = await client.DELETE("/users/{user_ref}/apikey", {
    params: { path: { user_ref: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status >= 400) {
    throw new CrucibleResponseError(result.response.status)
  }
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
      api_key_status: null,
      email: input.email ?? null,
      first_name: input.first_name,
      is_service_account: false,
      last_name: input.last_name,
      platform_role: null,
      unique_id: input.unique_id || "0000-0000-0000-9999",
      user_capabilities: fixtureUserCapabilities,
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
  const result = await client.POST("/users/{user_ref}/apikey", {
    params: { path: { user_ref: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function checkWorkspaceEmailExactMatch(
  email: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<boolean> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const users = fixtureUsers(scenario)
    return users.some(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    )
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/users", {
    params: { query: { email, limit: 1 } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data.items.length > 0
}
