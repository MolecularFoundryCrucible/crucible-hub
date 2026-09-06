import "@tanstack/react-start/server-only"

import { readWorkspaceFromApi } from "@/data/crucible/workspace-api.server"
import { readWorkspaceConfiguration } from "@/data/crucible/workspace-config.server"
import { readWorkspaceFixture } from "@/data/crucible/workspace-fixture.server"
import type { WorkspaceSource } from "@/data/crucible/workspace-source"
import type { FixtureScenario } from "./fixture-scenarios"

export function readWorkspace(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): WorkspaceSource | Promise<WorkspaceSource> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "fixture") return readWorkspaceFixture(scenario)
  if (configuration.mode === "unavailable") {
    return { status: "unavailable", reason: configuration.reason }
  }

  return readWorkspaceFromApi({ ...configuration, signal: requestSignal })
}
