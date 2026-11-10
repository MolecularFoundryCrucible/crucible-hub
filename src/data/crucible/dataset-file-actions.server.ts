import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"

export async function renameDatasetFile(
  fileMfid: string,
  filename: string,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<void> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") return
  const result = await createCrucibleClient(configuration).PATCH(
    "/files/{file_id}",
    {
      body: { filename },
      params: { path: { file_id: fileMfid } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}

export async function removeDatasetFile(
  fileMfid: string,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<void> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") return
  const result = await createCrucibleClient(configuration).DELETE(
    "/files/{file_id}",
    {
      params: { path: { file_id: fileMfid } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}
