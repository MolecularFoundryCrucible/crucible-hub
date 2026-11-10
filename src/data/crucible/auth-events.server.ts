import "@tanstack/react-start/server-only"

import { requireAdministratorView } from "@/server/crucible/privilege-mode.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceAuthEvent,
  WorkspaceAuthEventPage,
} from "./workspace-source"

export type AuthEventOwner = { kind: "self" } | { kind: "user"; userId: string }

const hour = 60 * 60 * 1000

function fixtureAuthEvents(scenario?: FixtureScenario): WorkspaceAuthEvent[] {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const reference = Date.parse(source.workspace.referenceTime)
  const at = (hours: number) => new Date(reference + hours * hour).toISOString()
  return [
    {
      actor_unique_id: null,
      at: at(-2),
      client_id: "crucible-hub",
      event: "sign_in",
      id: 4,
      issuer: "https://orcid.org",
    },
    {
      actor_unique_id: null,
      at: at(-30),
      client_id: null,
      event: "api_key_created",
      id: 3,
      issuer: null,
    },
    {
      actor_unique_id: null,
      at: at(-31),
      client_id: "crucible-hub",
      event: "sign_in_failed",
      id: 2,
      issuer: "https://orcid.org",
    },
    {
      actor_unique_id: "0000-0000-0000-0001",
      at: at(-24 * 20),
      client_id: null,
      event: "approved",
      id: 1,
      issuer: null,
    },
  ]
}

function toWorkspaceAuthEvent(event: WorkspaceAuthEvent): WorkspaceAuthEvent {
  return {
    actor_unique_id: event.actor_unique_id ?? null,
    at: event.at,
    client_id: event.client_id ?? null,
    event: event.event,
    id: event.id,
    issuer: event.issuer ?? null,
  }
}

export async function readWorkspaceAuthEvents(
  owner: AuthEventOwner,
  query: { cursor?: string; limit: number },
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceAuthEventPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const items = fixtureAuthEvents(scenario)
    return { items, nextCursor: null, total: items.length }
  }
  const params = { query: { cursor: query.cursor, limit: query.limit } }
  const result =
    owner.kind === "self"
      ? await createCrucibleClient(configuration).GET("/account/auth-events", {
          params,
          signal: crucibleRequestSignal(requestSignal),
        })
      : await createCrucibleClient(configuration, {
          privilegeMode: requireAdministratorView(),
        }).GET("/users/{user_ref}/auth-events", {
          params: { ...params, path: { user_ref: owner.userId } },
          signal: crucibleRequestSignal(requestSignal),
        })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return {
    items: result.data.items.map(toWorkspaceAuthEvent),
    nextCursor: result.data.next_cursor ?? null,
    total: result.data.total ?? null,
  }
}
