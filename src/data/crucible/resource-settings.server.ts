import "@tanstack/react-start/server-only"

import { z } from "zod"

import { createCrucibleClient } from "@/server/crucible/client.server"
import {
  CrucibleContractError,
  CrucibleResponseError,
} from "@/server/crucible/request-error.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"

import type { FixtureScenario } from "./fixture-scenarios"
import type {
  WorkspaceResourceSettings,
  WorkspaceSettingsKind,
} from "./workspace-source"
import { readWorkspaceConfiguration } from "./workspace-config.server"

const apiSettingsSchema = z
  .object({
    revision: z.number().int().min(0),
    settings: z
      .object({ default_store_id: z.string().nullable().optional() })
      .passthrough(),
  })
  .passthrough()

const fixtureSettings = new Map<
  string,
  { defaultStoreId: string | null; revision: number }
>()

function etagFor(revision: number) {
  return `"s${revision}"`
}

function fixtureKey(mfid: string, scenario?: FixtureScenario) {
  return `${scenario ?? "populated"}\0${mfid}`
}

function fixtureDocument(mfid: string, scenario?: FixtureScenario) {
  const current = fixtureSettings.get(fixtureKey(mfid, scenario)) ?? {
    defaultStoreId: null,
    revision: 0,
  }
  return { ...current, etag: etagFor(current.revision) }
}

function apiDocument(
  data: unknown,
  response: Response
): WorkspaceResourceSettings {
  const parsed = apiSettingsSchema.safeParse(data)
  if (!parsed.success) {
    throw new CrucibleContractError("resource-settings", parsed.error.issues)
  }
  return {
    defaultStoreId: parsed.data.settings.default_store_id ?? null,
    etag:
      response.headers.get("ETag")?.replace(/^W\//, "") ??
      etagFor(parsed.data.revision),
    revision: parsed.data.revision,
  }
}

export async function readWorkspaceResourceSettings(
  kind: WorkspaceSettingsKind,
  mfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceResourceSettings> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") return fixtureDocument(mfid, scenario)

  const client = createCrucibleClient(configuration)
  const signal = crucibleRequestSignal(requestSignal)
  const result =
    kind === "project"
      ? await client.GET("/projects/{project_ref}/settings", {
          params: { path: { project_ref: mfid } },
          signal,
        })
      : await client.GET("/instruments/{instrument_ref}/settings", {
          params: { path: { instrument_ref: mfid } },
          signal,
        })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return apiDocument(result.data, result.response)
}

export async function updateWorkspaceDefaultStore(
  kind: WorkspaceSettingsKind,
  mfid: string,
  defaultStoreId: string | null,
  etag: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceResourceSettings> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const current = fixtureDocument(mfid, scenario)
    if (current.etag !== etag) {
      throw new CrucibleResponseError(new Response(null, { status: 412 }), {
        detail: { code: "etag_mismatch" },
      })
    }
    const next = { defaultStoreId, revision: current.revision + 1 }
    fixtureSettings.set(fixtureKey(mfid, scenario), next)
    return { ...next, etag: etagFor(next.revision) }
  }

  const client = createCrucibleClient(configuration)
  const body = { default_store_id: defaultStoreId }
  const signal = crucibleRequestSignal(requestSignal)
  const header = { "if-match": etag }
  const result =
    kind === "project"
      ? await client.PATCH("/projects/{project_ref}/settings", {
          body,
          params: { header, path: { project_ref: mfid } },
          signal,
        })
      : await client.PATCH("/instruments/{instrument_ref}/settings", {
          body,
          params: { header, path: { instrument_ref: mfid } },
          signal,
        })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return apiDocument(result.data, result.response)
}
