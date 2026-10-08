import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { demoWorkspace } from "./fixtures/demo-workspace"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceServiceAccount,
  WorkspaceServiceAccountCredential,
  WorkspaceServiceAccountDetail,
  WorkspaceServiceAccountPage,
  WorkspaceServiceAccountPlatformRole,
  WorkspaceServiceAccountProfileUpdate,
} from "./workspace-source"

type ServiceAccountListInput = {
  limit: number
  offset: number
  query?: string
  scenario?: FixtureScenario
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
            email: null,
            first_name: member.first_name,
            is_service_account: true,
            last_name: member.last_name,
            platform_role: "contributor" as const,
            unique_id: member.unique_id,
            username: member.username ?? member.unique_id,
          },
        ])
    ).values(),
  ]
}

export async function readWorkspaceServiceAccounts(
  input: ServiceAccountListInput,
  requestSignal?: AbortSignal
): Promise<WorkspaceServiceAccountPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const query = input.query?.toLocaleLowerCase()
    const items = fixtureServiceAccounts(input.scenario).filter((account) =>
      query
        ? [account.username, account.first_name, account.last_name].some(
            (value) => value.toLocaleLowerCase().includes(query)
          )
        : true
    )
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
  const result = await client.GET("/service_accounts", {
    params: {
      query: {
        limit: input.limit,
        offset: input.offset,
        q: input.query,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return {
    items: result.data.items,
    limit: result.data.limit,
    offset: result.data.offset ?? input.offset,
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
    return {
      ...account,
      api_key_status: {
        created_at: demoWorkspace.referenceTime,
        expires_at: "2027-09-01T16:00:00Z",
        valid: true,
      },
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/service_accounts/{service_account_ref}", {
    params: { path: { service_account_ref: serviceAccountMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 404) return null
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
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
    privilegeMode: "elevated",
  })
  const result = await client.POST("/service_accounts", {
    body: account,
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
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
      first_name:
        changes.first_name === null
          ? ""
          : (changes.first_name ?? account.first_name),
      is_service_account: true,
      last_name:
        changes.last_name === null
          ? ""
          : (changes.last_name ?? account.last_name),
      username: changes.username ?? account.username,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.PATCH("/users/{user_ref}", {
    body: changes,
    params: { path: { user_ref: serviceAccountMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  const account = await readWorkspaceServiceAccount(
    serviceAccountMfid,
    scenario,
    requestSignal
  )
  if (!account) throw new CrucibleResponseError(404)
  return account
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
    privilegeMode: "elevated",
  })
  const result = await client.PATCH("/service_accounts/{service_account_ref}", {
    body: { platform_role: platformRole },
    params: { path: { service_account_ref: serviceAccountMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
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
    privilegeMode: "elevated",
  })
  const result = await client.POST(
    "/service_accounts/{service_account_ref}/rotate_key",
    {
      params: { path: { service_account_ref: serviceAccountMfid } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}
