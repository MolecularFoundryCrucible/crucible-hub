import "@tanstack/react-start/server-only"

import { requireAdministratorView } from "@/server/crucible/privilege-mode.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceSignedInSession,
  WorkspaceSignedInSessionPage,
} from "./workspace-source"

export type SessionOwner = { kind: "self" } | { kind: "user"; userId: string }

const hour = 60 * 60 * 1000

function apiConfiguration() {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  return configuration
}

function fixtureSessions(
  owner: SessionOwner,
  scenario?: FixtureScenario
): WorkspaceSignedInSession[] {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const reference = Date.parse(source.workspace.referenceTime)
  const at = (hours: number) => new Date(reference + hours * hour).toISOString()
  return [
    {
      client_id: "crucible-hub",
      client_name: "Crucible Hub",
      created_at: at(-2),
      current: owner.kind === "self",
      expires_at: at(24 * 30),
      id: "session-hub",
      last_used_at: at(0),
      signed_in_at: at(-2),
    },
    {
      client_id: "nano-crucible",
      client_name: "nano-crucible",
      created_at: at(-24 * 6),
      current: false,
      expires_at: at(24 * 24),
      id: "session-cli",
      last_used_at: at(-5),
      signed_in_at: at(-24 * 6),
    },
  ]
}

function toWorkspaceSession(
  session: WorkspaceSignedInSession
): WorkspaceSignedInSession {
  return {
    client_id: session.client_id,
    client_name: session.client_name,
    created_at: session.created_at,
    current: session.current,
    expires_at: session.expires_at,
    id: session.id,
    last_used_at: session.last_used_at,
    signed_in_at: session.signed_in_at ?? null,
  }
}

export async function readWorkspaceSessions(
  owner: SessionOwner,
  query: { cursor?: string; limit: number },
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceSignedInSessionPage> {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") {
    const items = fixtureSessions(owner, scenario)
    return { items, nextCursor: null, total: items.length }
  }
  const params = { query: { cursor: query.cursor, limit: query.limit } }
  const result =
    owner.kind === "self"
      ? await createCrucibleClient(configuration).GET("/account/sessions", {
          params,
          signal: crucibleRequestSignal(requestSignal),
        })
      : await createCrucibleClient(configuration, {
          privilegeMode: requireAdministratorView(),
        }).GET("/users/{user_ref}/sessions", {
          params: { ...params, path: { user_ref: owner.userId } },
          signal: crucibleRequestSignal(requestSignal),
        })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return {
    items: result.data.items.map(toWorkspaceSession),
    nextCursor: result.data.next_cursor ?? null,
    total: result.data.total ?? result.data.items.length,
  }
}

export async function endWorkspaceSession(
  owner: SessionOwner,
  sessionId: string,
  requestSignal?: AbortSignal
) {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") return
  const result =
    owner.kind === "self"
      ? await createCrucibleClient(configuration).DELETE(
          "/account/sessions/{session_id}",
          {
            params: { path: { session_id: sessionId } },
            signal: crucibleRequestSignal(requestSignal),
          }
        )
      : await createCrucibleClient(configuration, {
          privilegeMode: requireAdministratorView(),
        }).DELETE("/users/{user_ref}/sessions/{session_id}", {
          params: { path: { session_id: sessionId, user_ref: owner.userId } },
          signal: crucibleRequestSignal(requestSignal),
        })
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}

export async function endOtherWorkspaceSessions(
  owner: SessionOwner,
  requestSignal?: AbortSignal
) {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") return
  const result =
    owner.kind === "self"
      ? await createCrucibleClient(configuration).DELETE("/account/sessions", {
          signal: crucibleRequestSignal(requestSignal),
        })
      : await createCrucibleClient(configuration, {
          privilegeMode: requireAdministratorView(),
        }).DELETE("/users/{user_ref}/sessions", {
          params: { path: { user_ref: owner.userId } },
          signal: crucibleRequestSignal(requestSignal),
        })
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}
