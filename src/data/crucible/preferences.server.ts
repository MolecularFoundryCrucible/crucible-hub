import "@tanstack/react-start/server-only"

import { z } from "zod"

import { createCrucibleClient } from "@/server/crucible/client.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"

import { accountPreferencesSchema, applyMergePatch } from "./preferences"
import type {
  AccountPreferences,
  AccountPreferencesDocument,
  AccountPreferencesPatch,
  AccountPreferencesUpdate,
} from "./preferences"
import type { FixtureScenario } from "./fixture-scenarios"
import {
  readAccountPreferencesEnabled,
  readWorkspaceConfiguration,
} from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import { readGlobalPrivilegeMode } from "@/server/crucible/privilege-mode.server"

const apiDocumentSchema = z.object({
  preferences: z.record(z.string(), z.unknown()),
  revision: z.number().int().min(0),
  schema_version: z.number().int(),
  updated_at: z.string().nullable().default(null),
})

const etagMismatchSchema = z.object({
  detail: z.object({ code: z.literal("etag_mismatch") }),
})

type FixturePreferences = {
  preferences: AccountPreferences
  revision: number
  updatedAt: string | null
}

const fixtureStoreKey = Symbol.for("crucible.hub.fixture-preferences")
const fixtureGlobals = globalThis as typeof globalThis & {
  [fixtureStoreKey]?: Map<string, FixturePreferences>
}
const fixturePreferences = (fixtureGlobals[fixtureStoreKey] ??= new Map())

function etagFor(revision: number) {
  return `"p${revision}"`
}

function toDocument(
  preferences: unknown,
  revision: number,
  updatedAt: string | null,
  etag?: string | null
): AccountPreferencesDocument {
  return {
    etag: etag ?? etagFor(revision),
    preferences: accountPreferencesSchema.parse(preferences),
    revision,
    updatedAt,
  }
}

function readConfiguration() {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (!readAccountPreferencesEnabled(configuration.mode)) {
    throw new Error("Account preferences are not enabled on this server.")
  }
  return configuration
}

function fixtureAccountId(scenario?: FixtureScenario) {
  const source = readWorkspaceFixture(scenario, readGlobalPrivilegeMode())
  if (source.status === "unavailable") throw new Error(source.reason)
  return source.workspace.account.unique_id
}

function fixtureDocument(accountId: string) {
  const current = fixturePreferences.get(accountId)
  return current
    ? toDocument(current.preferences, current.revision, current.updatedAt)
    : toDocument({}, 0, null)
}

function apiDocument(data: unknown, response: Response) {
  const parsed = apiDocumentSchema.parse(data)
  return toDocument(
    parsed.preferences,
    parsed.revision,
    parsed.updated_at,
    response.headers.get("ETag")
  )
}

export async function readAccountPreferences(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<AccountPreferencesDocument> {
  const configuration = readConfiguration()
  if (configuration.mode === "fixture") {
    return fixtureDocument(fixtureAccountId(scenario))
  }
  const result = await createCrucibleClient(configuration).GET(
    "/account/preferences",
    { signal: crucibleRequestSignal(requestSignal) }
  )
  if (!result.data) throw new CrucibleResponseError(result.response)
  return apiDocument(result.data, result.response)
}

export async function patchAccountPreferences(
  patch: AccountPreferencesPatch,
  etag: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<AccountPreferencesUpdate> {
  const configuration = readConfiguration()
  if (configuration.mode === "fixture") {
    const accountId = fixtureAccountId(scenario)
    const current = fixtureDocument(accountId)
    const next = {
      preferences: accountPreferencesSchema.parse(
        applyMergePatch(current.preferences, patch)
      ),
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    }
    fixturePreferences.set(accountId, next)
    return {
      document: toDocument(next.preferences, next.revision, next.updatedAt),
      state: etag === current.etag ? "saved" : "changed",
    }
  }

  const client = createCrucibleClient(configuration)
  let expected = etag
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await client.PATCH("/account/preferences", {
      body: patch,
      params: { header: { "if-match": expected } },
      signal: crucibleRequestSignal(requestSignal),
    })
    if (result.data) {
      return {
        document: apiDocument(result.data, result.response),
        state: attempt === 0 ? "saved" : "changed",
      }
    }
    if (
      result.response.status !== 412 ||
      !etagMismatchSchema.safeParse(result.error).success
    )
      throw new CrucibleResponseError(result.response, result.error)
    expected = (await readAccountPreferences(scenario, requestSignal)).etag
  }
  throw new Error("Your preferences changed elsewhere. Reload and try again.")
}
