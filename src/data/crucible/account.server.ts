import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type { WorkspaceAccount } from "./workspace-source"
import type { FixtureScenario } from "./fixture-scenarios"

export async function readWorkspaceAccount(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceAccount> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    return source.workspace.account
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/account/profile", {
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response.status)
  }

  return {
    unique_id: result.data.unique_id,
    username: result.data.username,
    first_name: result.data.first_name,
    last_name: result.data.last_name,
  }
}
