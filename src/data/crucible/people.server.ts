import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type { WorkspacePerson } from "./workspace-source"

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

function toWorkspacePerson(
  person: Schema<"UserRead"> | Schema<"UserPublicRead">
): WorkspacePerson {
  const accountType =
    "is_service_account" in person ? person.is_service_account : null
  return {
    first_name: person.first_name,
    is_service_account:
      typeof accountType === "boolean" ? accountType : null,
    last_name: person.last_name,
    unique_id: person.unique_id,
    username: person.username,
  }
}

export async function readWorkspacePerson(
  personId: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspacePerson | null> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    return (
      source.workspace.people.find((person) => person.unique_id === personId) ??
      null
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/users/{user_id}", {
    params: { path: { user_id: personId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 404) return null
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  return toWorkspacePerson(result.data)
}

export async function lookupWorkspaceServiceAccount(
  reference: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspacePerson | null> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    const member = source.workspace.projects
      .flatMap((project) =>
        "members" in project && project.members ? project.members : []
      )
      .find(
        (candidate) =>
          candidate.is_service_account === true &&
          (candidate.unique_id === reference ||
            candidate.username === reference)
      )
    return member ? toWorkspacePerson(member) : null
  }

  const client = createCrucibleClient(configuration)
  const byMfid = /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(reference)
  const result = await client.GET("/users", {
    params: {
      query: {
        is_service_account: true,
        limit: 1,
        permissive: false,
        ...(byMfid ? { unique_id: reference } : { username: reference }),
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }
  const person = result.data.items.at(0)
  return person ? toWorkspacePerson(person) : null
}
