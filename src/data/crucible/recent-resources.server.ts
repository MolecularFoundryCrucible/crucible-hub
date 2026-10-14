import "@tanstack/react-start/server-only"

import { createCrucibleClient } from "@/server/crucible/client.server"
import { readGlobalPrivilegeMode } from "@/server/crucible/privilege-mode.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"

import type { FixtureScenario } from "./fixture-scenarios"
import type { RecentResource } from "./recent-resources"
import {
  readAccountPreferencesEnabled,
  readWorkspaceConfiguration,
} from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type { Workspace } from "./workspace-source"

const fixtureLimit = 50
const fixtureStoreKey = Symbol.for("crucible.hub.fixture-recent-resources")
type FixtureView = { mfid: string; viewedAt: string }
const fixtureGlobals = globalThis as typeof globalThis & {
  [fixtureStoreKey]?: Map<string, FixtureView[]>
}
const fixtureViews = (fixtureGlobals[fixtureStoreKey] ??= new Map<
  string,
  FixtureView[]
>())

function readConfiguration() {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (!readAccountPreferencesEnabled(configuration.mode)) {
    throw new Error("Recent resources are not enabled on this server.")
  }
  return configuration
}

function fixtureWorkspace(scenario?: FixtureScenario) {
  const source = readWorkspaceFixture(scenario, readGlobalPrivilegeMode())
  if (source.status === "unavailable") throw new Error(source.reason)
  return source.workspace
}

function fixtureResource(
  workspace: Workspace,
  mfid: string
): Omit<RecentResource, "viewedAt"> | undefined {
  const sample = workspace.samples.find((item) => item.unique_id === mfid)
  if (sample) {
    return {
      kind: "sample",
      name: sample.sample_name,
      projectId: sample.project_id ?? null,
      uniqueId: mfid,
    }
  }
  const dataset = workspace.datasets.find((item) => item.unique_id === mfid)
  if (dataset) {
    return {
      kind: "dataset",
      name: dataset.dataset_name ?? mfid,
      projectId: dataset.project_id ?? null,
      uniqueId: mfid,
    }
  }
  const project = workspace.projects.find((item) => item.unique_id === mfid)
  if (project) {
    return {
      kind: "project",
      name: project.title ?? mfid,
      projectId: project.project_id,
      uniqueId: mfid,
    }
  }
  const instrument = workspace.instruments.find(
    (item) => item.unique_id === mfid
  )
  if (instrument) {
    return {
      kind: "instrument",
      name: instrument.instrument_name,
      projectId: null,
      uniqueId: mfid,
    }
  }
  return undefined
}

export async function readRecentResources(
  limit: number,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<RecentResource[]> {
  const configuration = readConfiguration()
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(scenario)
    return (fixtureViews.get(workspace.account.unique_id) ?? [])
      .flatMap((view) => {
        const resource = fixtureResource(workspace, view.mfid)
        return resource ? [{ ...resource, viewedAt: view.viewedAt }] : []
      })
      .slice(0, limit)
  }
  const result = await createCrucibleClient(configuration).GET(
    "/account/recent-resources",
    {
      params: { query: { limit } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response)
  return result.data.map((item) => ({
    kind: item.resource_type,
    name: item.name ?? item.resource_mfid,
    projectId: item.project_id ?? null,
    uniqueId: item.resource_mfid,
    viewedAt: item.viewed_at,
  }))
}

export async function recordRecentResource(
  mfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<void> {
  const configuration = readConfiguration()
  if (configuration.mode === "fixture") {
    const workspace = fixtureWorkspace(scenario)
    if (!fixtureResource(workspace, mfid)) throw new CrucibleResponseError(404)
    const accountId = workspace.account.unique_id
    fixtureViews.set(
      accountId,
      [
        { mfid, viewedAt: new Date().toISOString() },
        ...(fixtureViews.get(accountId) ?? []).filter(
          (view) => view.mfid !== mfid
        ),
      ].slice(0, fixtureLimit)
    )
    return
  }
  const result = await createCrucibleClient(configuration).POST(
    "/account/recent-resources",
    {
      body: { resource_mfid: mfid },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}

export async function clearRecentResources(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<void> {
  const configuration = readConfiguration()
  if (configuration.mode === "fixture") {
    fixtureViews.delete(fixtureWorkspace(scenario).account.unique_id)
    return
  }
  const result = await createCrucibleClient(configuration).DELETE(
    "/account/recent-resources",
    { signal: crucibleRequestSignal(requestSignal) }
  )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}
