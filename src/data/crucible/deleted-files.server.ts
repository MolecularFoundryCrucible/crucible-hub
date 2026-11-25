import "@tanstack/react-start/server-only"

import { z } from "zod"

import {
  CrucibleContractError,
  CrucibleResponseError,
} from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { demoWorkspace } from "./fixtures/demo-workspace"
import type { FixtureScenario } from "./fixture-scenarios"
import { apiDatasetFileSchema } from "./dataset-files.schema"
import type { WorkspacePrivilegeMode } from "./privilege-mode"
import type {
  WorkspaceDatasetFile,
  WorkspaceDeletedFile,
  WorkspaceDeletedFilePage,
} from "./workspace-source"
import { readWorkspaceConfiguration } from "./workspace-config.server"

const apiDeletedFilePageSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            dataset_mfid: z.string().min(1).max(255),
            deleted_at: z.string().min(1),
            file_mfid: z.string().min(1).max(255),
            filename: z.string().min(1).max(10_000),
            restorable_until: z.string().min(1),
            sha256_hash: z.string(),
            size: z.number().int().nonnegative(),
            store_id: z.string().nullable().optional(),
          })
          .passthrough()
      )
      .max(1_000),
    total: z.number().int().nonnegative(),
  })
  .passthrough()

const fixtureDeletedFiles = new Map<string, WorkspaceDeletedFile[]>()

function fixtureKey(datasetMfid: string, scenario?: FixtureScenario) {
  return `${scenario ?? "populated"}\0${datasetMfid}`
}

function fixtureDeleted(datasetMfid: string, scenario?: FixtureScenario) {
  const key = fixtureKey(datasetMfid, scenario)
  const stored = fixtureDeletedFiles.get(key)
  if (stored) return stored
  const day = 24 * 60 * 60 * 1000
  const initial: WorkspaceDeletedFile[] =
    (scenario ?? "populated") === "populated" &&
    datasetMfid === demoWorkspace.datasets[0].unique_id
      ? [
          {
            datasetMfid,
            deletedAt: new Date(Date.now() - 2 * day).toISOString(),
            fileMfid: "01J6Y8N4Q2R7M9K3T5V0W1X2ZF",
            filename: "operando-cycle-03.h5",
            restorableUntil: new Date(Date.now() + 28 * day).toISOString(),
            sha256Hash:
              "9f2c1d0e8b7a6f5e4d3c2b1a09f8e7d6c5b4a3928170f6e5d4c3b2a1908f7e6d",
            size: 276_031_488,
            storeId: "foundry",
          },
        ]
      : []
  fixtureDeletedFiles.set(key, initial)
  return initial
}

function takeFixtureDeleted(
  datasetMfid: string,
  fileMfid: string,
  scenario?: FixtureScenario
) {
  const files = fixtureDeleted(datasetMfid, scenario)
  const file = files.find((candidate) => candidate.fileMfid === fileMfid)
  if (!file) throw new CrucibleResponseError(404)
  fixtureDeletedFiles.set(
    fixtureKey(datasetMfid, scenario),
    files.filter((candidate) => candidate !== file)
  )
  return file
}

export async function readWorkspaceDeletedFiles(
  datasetMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal,
  privilegeMode?: WorkspacePrivilegeMode
): Promise<WorkspaceDeletedFilePage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const items = fixtureDeleted(datasetMfid, scenario)
    return { items, total: items.length }
  }

  const result = await createCrucibleClient(configuration, {
    privilegeMode,
  }).GET("/datasets/{dataset_mfid}/deleted_files", {
    params: {
      path: { dataset_mfid: datasetMfid },
      query: { limit: 100, offset: 0 },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  const page = apiDeletedFilePageSchema.safeParse(result.data)
  if (!page.success) {
    throw new CrucibleContractError("deleted-files", page.error.issues)
  }
  return {
    items: page.data.items.map((file) => ({
      datasetMfid: file.dataset_mfid,
      deletedAt: file.deleted_at,
      fileMfid: file.file_mfid,
      filename: file.filename,
      restorableUntil: file.restorable_until,
      sha256Hash: file.sha256_hash,
      size: file.size,
      storeId: file.store_id ?? null,
    })),
    total: page.data.total,
  }
}

export async function restoreWorkspaceDeletedFile(
  datasetMfid: string,
  fileMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceDatasetFile> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const file = takeFixtureDeleted(datasetMfid, fileMfid, scenario)
    return {
      access_note: null,
      dataset_id: 0,
      dataset_mfid: datasetMfid,
      filename: file.filename,
      mfid: file.fileMfid,
      sha256_hash: file.sha256Hash,
      size: file.size,
      storage_backend: "gcs",
      storage_path: null,
      store_id: file.storeId,
    }
  }

  const result = await createCrucibleClient(configuration).POST(
    "/datasets/{dataset_mfid}/deleted_files/{file_mfid}/restore",
    {
      params: { path: { dataset_mfid: datasetMfid, file_mfid: fileMfid } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  const file = apiDatasetFileSchema.safeParse(result.data)
  if (!file.success) {
    throw new CrucibleContractError("restored-file", file.error.issues)
  }
  return file.data
}

export async function purgeWorkspaceDeletedFile(
  datasetMfid: string,
  fileMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<void> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    takeFixtureDeleted(datasetMfid, fileMfid, scenario)
    return
  }

  const result = await createCrucibleClient(configuration).DELETE(
    "/datasets/{dataset_mfid}/deleted_files/{file_mfid}",
    {
      params: { path: { dataset_mfid: datasetMfid, file_mfid: fileMfid } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}
