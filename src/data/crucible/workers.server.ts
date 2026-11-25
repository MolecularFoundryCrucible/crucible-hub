import "@tanstack/react-start/server-only"

import { z } from "zod"

import { requireAdministratorView } from "@/server/crucible/privilege-mode.server"
import {
  CrucibleContractError,
  CrucibleResponseError,
} from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type { WorkspaceWorker } from "./workspace-source"

const apiWorkersSchema = z
  .array(
    z
      .object({
        buckets: z.array(z.string()),
        capabilities: z.array(
          z
            .object({
              description: z.string().nullable().optional(),
              file_extensions: z.array(z.string()).optional(),
              name: z.string(),
            })
            .passthrough()
        ),
        expires_at: z.string(),
        kind: z.string(),
        last_seen_at: z.string(),
        live: z.boolean(),
        package_version: z.string().nullable().optional(),
        registered_at: z.string(),
        store_ids: z.array(z.string()),
        worker_id: z.string(),
        worker_version: z.string().nullable().optional(),
      })
      .passthrough()
  )
  .max(1_000)

const minute = 60 * 1000

function fixtureWorkers(scenario?: FixtureScenario): WorkspaceWorker[] {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const reference = Date.parse(source.workspace.referenceTime)
  const at = (minutes: number) =>
    new Date(reference + minutes * minute).toISOString()
  const capabilities = [
    {
      description: "HDF5 files written by ScopeFoundry",
      file_extensions: [".h5"],
      name: "ScopeFoundryH5Ingestor",
    },
    { description: null, file_extensions: [".h5"], name: "H5Ingestor" },
    {
      description: "Images in common formats",
      file_extensions: [".png", ".jpg", ".tif"],
      name: "ImageIngestor",
    },
  ]
  return [
    {
      buckets: ["foundry-storage"],
      capabilities,
      expires_at: at(8),
      kind: "ingestion",
      last_seen_at: at(-2),
      live: true,
      package_version: "0.3.5",
      registered_at: at(-60 * 26),
      store_ids: ["foundry"],
      worker_id: "ingestion-worker-7d9f4-x2kq8",
      worker_version: "0.5.0",
    },
    {
      buckets: ["foundry-storage", "imaging-archive"],
      capabilities: capabilities.slice(1),
      expires_at: at(-60 * 3),
      kind: "ingestion",
      last_seen_at: at(-60 * 3 - 10),
      live: false,
      package_version: "0.3.4",
      registered_at: at(-60 * 20),
      store_ids: ["foundry", "imaging-archive"],
      worker_id: "ingestion-worker-6b2c1-p9wd4",
      worker_version: "0.4.2",
    },
  ]
}

export async function readWorkspaceWorkers(
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceWorker[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") return fixtureWorkers(scenario)

  const client = createCrucibleClient(configuration, {
    privilegeMode: requireAdministratorView(),
  })
  const result = await client.GET("/workers", {
    params: { query: { kind: "ingestion" } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  const workers = apiWorkersSchema.safeParse(result.data)
  if (!workers.success) {
    throw new CrucibleContractError("workers", workers.error.issues)
  }
  return workers.data.map((worker) => ({
    buckets: worker.buckets,
    capabilities: worker.capabilities.map((capability) => ({
      description: capability.description ?? null,
      file_extensions: capability.file_extensions ?? [],
      name: capability.name,
    })),
    expires_at: worker.expires_at,
    kind: worker.kind,
    last_seen_at: worker.last_seen_at,
    live: worker.live,
    package_version: worker.package_version ?? null,
    registered_at: worker.registered_at,
    store_ids: worker.store_ids,
    worker_id: worker.worker_id,
    worker_version: worker.worker_version ?? null,
  }))
}
