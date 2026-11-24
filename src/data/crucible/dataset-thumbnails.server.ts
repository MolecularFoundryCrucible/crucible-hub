import "@tanstack/react-start/server-only"

import { z } from "zod"
import { demoWorkspace } from "@/data/crucible/fixtures/demo-workspace"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import type { FixtureScenario } from "./fixture-scenarios"
import type {
  WorkspaceDatasetThumbnail,
  WorkspaceDatasetThumbnailOperation,
} from "./workspace-source"

import { fixtureWorkspace, readWorkspaceResource } from "./resources.server"

const apiDatasetThumbnailSchema = z
  .object({
    id: z.number().int().positive(),
    mime_type: z.literal("image/jpeg"),
    thumbnail_b64str: z
      .string()
      .min(1)
      .max(2_000_000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    thumbnail_name: z.string().min(1).max(10_000),
  })
  .passthrough()

const demoThumbnailBase64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAQABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKQBokf/2Q=="

const fixtureThumbnailState = new Map<string, WorkspaceDatasetThumbnail[]>()

function workspaceDatasetThumbnail(value: unknown): WorkspaceDatasetThumbnail {
  const result = apiDatasetThumbnailSchema.safeParse(value)
  if (!result.success) {
    throw new Error("The dataset thumbnail response is invalid.")
  }
  return {
    id: result.data.id,
    mime_type: result.data.mime_type,
    thumbnail_b64str: result.data.thumbnail_b64str,
    thumbnail_name: result.data.thumbnail_name,
  }
}

function fixtureThumbnailKey(datasetMfid: string, scenario?: FixtureScenario) {
  return `${scenario ?? "populated"}\0${datasetMfid}`
}

function readFixtureDatasetThumbnails(
  datasetMfid: string,
  scenario?: FixtureScenario
) {
  const dataset = fixtureWorkspace(scenario).datasets.find(
    (candidate) => candidate.unique_id === datasetMfid
  )
  if (!dataset) throw new CrucibleResponseError(404)
  const key = fixtureThumbnailKey(datasetMfid, scenario)
  const stored = fixtureThumbnailState.get(key)
  if (stored) return stored
  const thumbnails =
    datasetMfid === demoWorkspace.datasets[0].unique_id ||
    datasetMfid === "fixture-dataset-1"
      ? [
          {
            id: 1,
            mime_type: "image/jpeg" as const,
            thumbnail_b64str: demoThumbnailBase64,
            thumbnail_name: "Operando preview",
          },
          {
            id: 2,
            mime_type: "image/jpeg" as const,
            thumbnail_b64str: demoThumbnailBase64,
            thumbnail_name: "Bragg peak fit",
          },
          {
            id: 3,
            mime_type: "image/jpeg" as const,
            thumbnail_b64str: demoThumbnailBase64,
            thumbnail_name: "Reciprocal space map",
          },
        ]
      : []
  fixtureThumbnailState.set(key, thumbnails)
  return thumbnails
}

export async function readWorkspaceDatasetThumbnails(
  datasetMfid: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceDatasetThumbnail[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return readFixtureDatasetThumbnails(datasetMfid, scenario)
  }

  const client = createCrucibleClient(configuration)
  const result = await client.GET("/datasets/{dataset_mfid}/thumbnails", {
    params: { path: { dataset_mfid: datasetMfid } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return result.data.map(workspaceDatasetThumbnail)
}

export async function readWorkspaceDatasetThumbnailPreviews(
  datasetMfids: readonly string[],
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<Readonly<Partial<Record<string, WorkspaceDatasetThumbnail>>>> {
  const uniqueDatasetMfids = [...new Set(datasetMfids)]
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    return Object.fromEntries(
      uniqueDatasetMfids.flatMap((datasetMfid) => {
        const thumbnail = readFixtureDatasetThumbnails(
          datasetMfid,
          scenario
        ).at(0)
        return thumbnail ? [[datasetMfid, thumbnail]] : []
      })
    )
  }

  const client = createCrucibleClient(configuration)
  const result = await client.POST("/datasets/first_thumbnails", {
    body: uniqueDatasetMfids,
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return Object.fromEntries(
    Object.entries(result.data).map(([datasetMfid, thumbnail]) => [
      datasetMfid,
      workspaceDatasetThumbnail(thumbnail),
    ])
  )
}

export async function mutateWorkspaceDatasetThumbnails(
  operation: WorkspaceDatasetThumbnailOperation,
  requestSignal?: AbortSignal
): Promise<readonly WorkspaceDatasetThumbnail[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const dataset = await readWorkspaceResource(
      operation.datasetMfid,
      operation.scenario,
      requestSignal
    )
    if (dataset?.kind !== "dataset" || !dataset.capabilities?.can_edit) {
      throw new CrucibleResponseError(404)
    }
    const current = [
      ...readFixtureDatasetThumbnails(
        operation.datasetMfid,
        operation.scenario
      ),
    ]
    if (operation.action === "add") {
      const duplicate = current.find(
        (thumbnail) => thumbnail.thumbnail_b64str === operation.thumbnail_b64str
      )
      if (duplicate) duplicate.thumbnail_name = operation.thumbnail_name
      else {
        current.push({
          id: Math.max(0, ...current.map((thumbnail) => thumbnail.id)) + 1,
          mime_type: "image/jpeg",
          thumbnail_b64str: operation.thumbnail_b64str,
          thumbnail_name: operation.thumbnail_name,
        })
      }
    } else if (operation.action === "rename") {
      const thumbnail = current.find(
        (candidate) => candidate.id === operation.thumbnailId
      )
      if (!thumbnail) throw new CrucibleResponseError(404)
      thumbnail.thumbnail_name = operation.thumbnail_name
    } else {
      const index = current.findIndex(
        (thumbnail) => thumbnail.id === operation.thumbnailId
      )
      if (index < 0) throw new CrucibleResponseError(404)
      current.splice(index, 1)
    }
    fixtureThumbnailState.set(
      fixtureThumbnailKey(operation.datasetMfid, operation.scenario),
      current
    )
    return current
  }

  const client = createCrucibleClient(configuration)
  if (operation.action === "add") {
    const result = await client.POST("/datasets/{dataset_mfid}/thumbnails", {
      body: {
        thumbnail_b64str: operation.thumbnail_b64str,
        thumbnail_name: operation.thumbnail_name,
      },
      params: { path: { dataset_mfid: operation.datasetMfid } },
      signal: crucibleRequestSignal(requestSignal),
    })
    if (!result.data)
      throw new CrucibleResponseError(result.response, result.error)
  } else if (operation.action === "rename") {
    const result = await client.PATCH(
      "/datasets/{dataset_mfid}/thumbnails/{thumbnail_id}",
      {
        body: { thumbnail_name: operation.thumbnail_name },
        params: {
          path: {
            dataset_mfid: operation.datasetMfid,
            thumbnail_id: operation.thumbnailId,
          },
        },
        signal: crucibleRequestSignal(requestSignal),
      }
    )
    if (!result.data)
      throw new CrucibleResponseError(result.response, result.error)
  } else {
    const result = await client.DELETE(
      "/datasets/{dataset_mfid}/thumbnails/{thumbnail_id}",
      {
        params: {
          path: {
            dataset_mfid: operation.datasetMfid,
            thumbnail_id: operation.thumbnailId,
          },
        },
        signal: crucibleRequestSignal(requestSignal),
      }
    )
    if (!result.data)
      throw new CrucibleResponseError(result.response, result.error)
  }
  return readWorkspaceDatasetThumbnails(
    operation.datasetMfid,
    operation.scenario,
    requestSignal
  )
}
