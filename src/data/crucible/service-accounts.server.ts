import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { requireAdministratorView } from "@/server/crucible/privilege-mode.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { demoWorkspace } from "./fixtures/demo-workspace"
import type { FixtureScenario } from "./fixture-scenarios"
import { fixtureCursorPage } from "./pagination"
import { userActivityQuery } from "./user-activity"
import type { UserActivityFilter } from "./user-activity"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceServiceAccount,
  WorkspaceServiceAccountCredential,
  WorkspaceServiceAccountDetail,
  WorkspaceServiceAccountPage,
  WorkspaceServiceAccountPlatformRole,
  WorkspaceServiceAccountProfileUpdate,
  WorkspaceServiceAccountSort,
} from "./workspace-source"

type ServiceAccountListInput = {
  activity?: UserActivityFilter
  cursor?: string
  direction?: "asc" | "desc"
  includeTotal?: boolean
  limit: number
  query?: string
  scenario?: FixtureScenario
  sort?: WorkspaceServiceAccountSort
}

function toWorkspaceServiceAccount(
  user:
    | components["schemas"]["ServiceAccountAdminRead"]
    | components["schemas"]["UserRead"]
): WorkspaceServiceAccount {
  return {
    ...("api_key_status" in user
      ? { api_key_status: user.api_key_status ?? null }
      : {}),
    email: user.email ?? null,
    first_name: user.first_name,
    is_service_account: true,
    last_active_at:
      "last_active_at" in user ? (user.last_active_at ?? null) : null,
    last_name: user.last_name,
    platform_role: user.platform_role ?? "contributor",
    unique_id: user.unique_id,
    username: user.username ?? user.unique_id,
  }
}

function toWorkspaceServiceAccountDetail(
  user:
    | components["schemas"]["ServiceAccountAdminDetail"]
    | components["schemas"]["UserRead"]
): WorkspaceServiceAccountDetail {
  return {
    ...toWorkspaceServiceAccount(user),
    api_key_status: user.api_key_status ?? null,
  }
}

function fixtureServiceAccounts(
  scenario?: FixtureScenario
): WorkspaceServiceAccount[] {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const members = source.workspace.projects.flatMap((project) =>
    "members" in project && project.members ? project.members : []
  )
  return [
    ...new Map(
      members
        .filter((member) => member.is_service_account === true)
        .map((member) => [
          member.unique_id,
          {
            api_key_status: {
              created_at: demoWorkspace.referenceTime,
              expires_at: "2027-09-01T16:00:00Z",
              last_used_at: "2026-10-13T09:20:00Z",
              valid: true,
            },
            email: null,
            first_name: member.first_name,
            is_service_account: true,
            last_active_at: "2026-09-28T10:00:00Z",
            last_name: member.last_name,
            platform_role: "contributor" as const,
            unique_id: member.unique_id,
            username: member.username ?? member.unique_id,
          },
        ])
    ).values(),
  ]
}

function sortFixtureServiceAccounts(
  items: WorkspaceServiceAccount[],
  sort: WorkspaceServiceAccountSort | undefined,
  direction: "asc" | "desc" | undefined
): WorkspaceServiceAccount[] {
  if (!sort && !direction) return items
  const factor = direction === "desc" ? -1 : 1
  return [...items].sort((a, b) => {
    let comparison = 0
    if (sort === "unique_id") {
      comparison = a.unique_id.localeCompare(b.unique_id)
    } else if (sort === "last_active") {
      comparison = (a.last_active_at ?? "").localeCompare(
        b.last_active_at ?? ""
      )
    } else {
      comparison = a.username.localeCompare(b.username)
    }
    if (comparison !== 0) return comparison * factor
    return a.unique_id.localeCompare(b.unique_id) * factor
  })
}

export async function readWorkspaceServiceAccounts(
  input: ServiceAccountListInput,
  requestSignal?: AbortSignal
): Promise<WorkspaceServiceAccountPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    let items = fixtureServiceAccounts(input.scenario)
    if (input.query) {
      const q = input.query.toLowerCase()
      items = items.filter((account) =>
        [
          account.username,
          account.first_name,
          account.last_name,
          account.unique_id,
        ].some((value) => value.toLowerCase().includes(q))
      )
    }
    const activity = userActivityQuery(input.activity)
    items = items.filter((account) => {
      if (activity.never_active) return !account.last_active_at
      if (activity.active_since) {
        return Boolean(
          account.last_active_at &&
          account.last_active_at >= activity.active_since
        )
      }
      if (activity.inactive_since) {
        return (
          !account.last_active_at ||
          account.last_active_at < activity.inactive_since
        )
      }
      return true
    })
    items = sortFixtureServiceAccounts(items, input.sort, input.direction)
    const page = fixtureCursorPage(items, {
      cursor: input.cursor,
      limit: input.limit,
    })
    return input.includeTotal === false ? { ...page, total: null } : page
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: requireAdministratorView(),
  })
  const result = await client.GET("/users", {
    params: {
      query: {
        cursor: input.cursor,
        direction: input.direction,
        include_total: input.includeTotal,
        is_service_account: true,
        limit: input.limit,
        q: input.query,
        sort: input.sort,
        ...userActivityQuery(input.activity),
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response)
  return {
    items: result.data.items.map(toWorkspaceServiceAccount),
    limit: result.data.limit,
    nextCursor: result.data.next_cursor ?? null,
    total: result.data.total ?? null,
  }
}

export async function readWorkspaceServiceAccount(
  serviceAccountMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceServiceAccountDetail | null> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const account = fixtureServiceAccounts(scenario).find(
      (candidate) => candidate.unique_id === serviceAccountMfid
    )
    if (!account) return null
    return { ...account, api_key_status: account.api_key_status ?? null }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: requireAdministratorView(),
  })
  const result = await client.GET("/users/{user_ref}", {
    params: { path: { user_ref: serviceAccountMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 404) return null
  if (!result.data) throw new CrucibleResponseError(result.response)
  if (!result.data.is_service_account) return null
  return toWorkspaceServiceAccountDetail(result.data)
}

export async function createWorkspaceServiceAccount(
  account: { unique_id?: string; username: string },
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceServiceAccountCredential> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    return {
      api_key: `fixture-${crypto.randomUUID()}`,
      is_service_account: true,
      unique_id: account.unique_id ?? `fixture-sa-${crypto.randomUUID()}`,
      username: account.username,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: requireAdministratorView(),
  })
  const result = await client.POST("/service_accounts", {
    body: account,
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data)
    throw new CrucibleResponseError(result.response, result.error)
  return result.data
}

export async function patchWorkspaceServiceAccount(
  serviceAccountMfid: string,
  changes: WorkspaceServiceAccountProfileUpdate,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceServiceAccountDetail> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const account = await readWorkspaceServiceAccount(
      serviceAccountMfid,
      scenario,
      requestSignal
    )
    if (!account) throw new CrucibleResponseError(404)
    return {
      ...account,
      ...changes,
      first_name: changes.first_name ?? account.first_name,
      is_service_account: true,
      last_name: changes.last_name ?? account.last_name,
      username: changes.username ?? account.username,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: requireAdministratorView(),
  })
  const result = await client.PATCH("/users/{user_ref}", {
    body: changes,
    params: { path: { user_ref: serviceAccountMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data)
    throw new CrucibleResponseError(result.response, result.error)
  return toWorkspaceServiceAccountDetail(result.data)
}

export async function patchWorkspaceServiceAccountPlatformRole(
  serviceAccountMfid: string,
  platformRole: WorkspaceServiceAccountPlatformRole,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceServiceAccountDetail> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const account = await readWorkspaceServiceAccount(
      serviceAccountMfid,
      scenario,
      requestSignal
    )
    if (!account) throw new CrucibleResponseError(404)
    return { ...account, platform_role: platformRole }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: requireAdministratorView(),
  })
  const result = await client.PATCH("/service_accounts/{service_account_ref}", {
    body: { platform_role: platformRole },
    params: { path: { service_account_ref: serviceAccountMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response)
  return toWorkspaceServiceAccountDetail(result.data)
}

export async function rotateWorkspaceServiceAccountKey(
  serviceAccountMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceServiceAccountCredential> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const account = await readWorkspaceServiceAccount(
      serviceAccountMfid,
      scenario,
      requestSignal
    )
    if (!account) throw new CrucibleResponseError(404)
    return {
      api_key: `fixture-${crypto.randomUUID()}`,
      is_service_account: true,
      unique_id: account.unique_id,
      username: account.username,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: requireAdministratorView(),
  })
  const result = await client.POST(
    "/service_accounts/{service_account_ref}/rotate_key",
    {
      params: { path: { service_account_ref: serviceAccountMfid } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response)
  return result.data
}
