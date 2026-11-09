import "@tanstack/react-start/server-only"

import { requireAdministratorView } from "@/server/crucible/privilege-mode.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceApiKey,
  WorkspaceApiKeyPage,
  WorkspaceApiKeyState,
  WorkspaceCreatedApiKey,
} from "./workspace-source"

export type ApiKeyOwner = { kind: "self" } | { kind: "user"; userId: string }

const day = 24 * 60 * 60 * 1000

function apiConfiguration() {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  return configuration
}

function fixtureReferenceTime(scenario?: FixtureScenario) {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  return Date.parse(source.workspace.referenceTime)
}

function at(reference: number, days: number) {
  return new Date(reference + days * day).toISOString()
}

function fixtureApiKeys(
  state: WorkspaceApiKeyState,
  reference: number
): WorkspaceApiKey[] {
  if (state === "inactive") {
    return [
      {
        created_at: at(reference, -240),
        expires_at: at(reference, 125),
        id: 1,
        last4: "9d04",
        last_used_at: at(reference, -61),
        name: "Old laptop",
        older_routes: false,
        revoked_at: at(reference, -60),
        status: "revoked",
      },
    ]
  }
  return [
    {
      created_at: at(reference, -30),
      expires_at: at(reference, 335),
      id: 3,
      last4: "7f3a",
      last_used_at: at(reference, -1),
      name: "Analysis workstation",
      older_routes: false,
      revoked_at: null,
      status: "active",
    },
    {
      created_at: at(reference, -200),
      expires_at: at(reference, 165),
      id: 2,
      last4: "c21e",
      last_used_at: null,
      name: "Default key",
      older_routes: true,
      revoked_at: null,
      status: "active",
    },
  ]
}

function toWorkspaceApiKey(key: WorkspaceApiKey): WorkspaceApiKey {
  return {
    created_at: key.created_at,
    expires_at: key.expires_at ?? null,
    id: key.id,
    last4: key.last4,
    last_used_at: key.last_used_at ?? null,
    name: key.name ?? null,
    older_routes: key.older_routes,
    revoked_at: key.revoked_at ?? null,
    status: key.status,
  }
}

export async function readWorkspaceApiKeys(
  owner: ApiKeyOwner,
  query: { cursor?: string; limit: number; state: WorkspaceApiKeyState },
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceApiKeyPage> {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") {
    const items = fixtureApiKeys(query.state, fixtureReferenceTime(scenario))
    return { items, nextCursor: null, total: items.length }
  }
  const params = {
    query: {
      cursor: query.cursor,
      limit: query.limit,
      state: query.state,
    },
  }
  const result =
    owner.kind === "self"
      ? await createCrucibleClient(configuration).GET("/account/apikeys", {
          params,
          signal: crucibleRequestSignal(requestSignal),
        })
      : await createCrucibleClient(configuration, {
          privilegeMode: requireAdministratorView(),
        }).GET("/users/{user_ref}/apikeys", {
          params: { ...params, path: { user_ref: owner.userId } },
          signal: crucibleRequestSignal(requestSignal),
        })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return {
    items: result.data.items.map(toWorkspaceApiKey),
    nextCursor: result.data.next_cursor ?? null,
    total: result.data.total ?? result.data.items.length,
  }
}

export async function createWorkspaceApiKey(
  input: { expiresAt: string | null; name: string },
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceCreatedApiKey> {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") {
    const reference = fixtureReferenceTime(scenario)
    return {
      api_key: `crucible_fixture${crypto.randomUUID().replaceAll("-", "")}`,
      created_at: at(reference, 0),
      expires_at: input.expiresAt ?? at(reference, 365),
      id: 4,
      last4: "f1x7",
      last_used_at: null,
      name: input.name,
      older_routes: false,
      revoked_at: null,
      status: "active",
    }
  }
  const result = await createCrucibleClient(configuration).POST(
    "/account/apikeys",
    {
      body: {
        name: input.name,
        ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return result.data
}

export async function renameWorkspaceApiKey(
  keyId: number,
  name: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceApiKey> {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") {
    const key = fixtureApiKeys("active", fixtureReferenceTime(scenario)).find(
      (candidate) => candidate.id === keyId
    )
    if (!key) throw new CrucibleResponseError(404)
    return { ...key, name }
  }
  const result = await createCrucibleClient(configuration).PATCH(
    "/account/apikeys/{key_id}",
    {
      body: { name },
      params: { path: { key_id: keyId } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return toWorkspaceApiKey(result.data)
}

export async function revokeWorkspaceApiKey(
  owner: ApiKeyOwner,
  keyId: number,
  requestSignal?: AbortSignal
) {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") return
  const result =
    owner.kind === "self"
      ? await createCrucibleClient(configuration).DELETE(
          "/account/apikeys/{key_id}",
          {
            params: { path: { key_id: keyId } },
            signal: crucibleRequestSignal(requestSignal),
          }
        )
      : await createCrucibleClient(configuration, {
          privilegeMode: requireAdministratorView(),
        }).DELETE("/users/{user_ref}/apikeys/{key_id}", {
          params: { path: { key_id: keyId, user_ref: owner.userId } },
          signal: crucibleRequestSignal(requestSignal),
        })
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}
