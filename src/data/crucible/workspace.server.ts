import "@tanstack/react-start/server-only"

import { readWorkspaceFromApi } from "@/data/crucible/workspace-api.server"
import { readWorkspaceConfiguration } from "@/data/crucible/workspace-config.server"
import { readWorkspaceFixture } from "@/data/crucible/workspace-fixture.server"
import type { WorkspaceSource } from "@/data/crucible/workspace-source"
import { readGlobalPrivilegeMode } from "@/server/crucible/privilege-mode.server"
import { hasHubSession } from "@/server/crucible/hub-auth.server"
import type { FixtureScenario } from "./fixture-scenarios"

export function readWorkspace(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): WorkspaceSource | Promise<WorkspaceSource> {
  const configuration = readWorkspaceConfiguration()
  const privilegeMode = readGlobalPrivilegeMode()
  if (configuration.mode === "fixture") {
    return readWorkspaceFixture(scenario, privilegeMode)
  }
  if (configuration.mode === "unavailable") {
    return {
      status: "unavailable",
      reason: configuration.reason,
      authRequired:
        process.env.HUB_DATA_SOURCE === "hub-auth" &&
        configuration.reason.startsWith("Sign in"),
    }
  }

  const source = readWorkspaceFromApi({
    ...configuration,
    privilegeMode,
    signal: requestSignal,
  })
  if (process.env.HUB_DATA_SOURCE !== "hub-auth") return source
  return source.then((result) =>
    result.status === "ready"
      ? { ...result, sessionAuth: true }
      : { ...result, authRequired: !hasHubSession() }
  )
}
