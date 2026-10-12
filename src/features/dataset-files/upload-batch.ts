import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import {
  useUploadIngestionEnabled,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { requestWorkspaceIngestion } from "@/data/crucible/resources.functions"
import { datasetIngestionRequestsQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import { validateUploadFilename } from "@/data/crucible/uploads"
import type { WorkspaceDatasetFile } from "@/data/crucible/workspace-source"

import { uploadDatasetFile } from "./upload-orchestrator"
import { useUploadLeaveGuard } from "./upload-leave-guard"

export const NO_INGESTION = null
export const AUTO_DETECT_INGESTION = ""

export type UploadIngestionChoice = string | null

export type UploadItemStatus =
  | { status: "staged" }
  | { bytes: number; status: "hashing" }
  | { bytes: number; status: "uploading" }
  | { status: "completing" }
  | {
      file: WorkspaceDatasetFile
      ingestion?: "requested" | { message: string }
      status: "done"
    }
  | { message: string; status: "error" }
  | { status: "aborted" }

export type UploadItem = {
  file: File
  filename: string
  id: string
  ingestionClass: UploadIngestionChoice
  state: UploadItemStatus
}

export type UploadSource = { file: File; path: string }

function isAborted(signal: AbortSignal) {
  return signal.aborted
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function uploadItemIssues(
  item: UploadItem,
  items: readonly UploadItem[],
  existingFilenames: ReadonlySet<string>
): readonly string[] {
  if (item.state.status === "done") return []
  const issues = [...validateUploadFilename(item.filename)]
  if (item.file.size === 0) issues.push("Empty files cannot be uploaded.")
  if (
    items.some(
      (other) => other.id !== item.id && other.filename === item.filename
    )
  ) {
    issues.push("Another file in this list has the same name.")
  }
  if (existingFilenames.has(item.filename)) {
    issues.push("A file with this name is already in the dataset.")
  }
  return issues
}

export function useUploadBatch({
  existingFilenames = new Set<string>(),
}: { existingFilenames?: ReadonlySet<string> } = {}) {
  const scope = useWorkspaceScope()
  const ingestionEnabled = useUploadIngestionEnabled()
  const queryClient = useQueryClient()
  const [items, setItems] = useState<UploadItem[]>([])
  const [uploading, setUploading] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const leaveGuard = useUploadLeaveGuard(uploading, () =>
    controller.current?.abort()
  )

  function update(id: string, change: (item: UploadItem) => UploadItem) {
    setItems((current) =>
      current.map((item) => (item.id === id ? change(item) : item))
    )
  }

  function setState(id: string, state: UploadItemStatus) {
    update(id, (item) => ({ ...item, state }))
  }

  function add(sources: readonly UploadSource[]) {
    setItems((current) => [
      ...current,
      ...sources.map((source) => ({
        file: source.file,
        filename: source.path,
        id: crypto.randomUUID(),
        ingestionClass: NO_INGESTION,
        state: { status: "staged" } as const,
      })),
    ])
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  function rename(id: string, filename: string) {
    update(id, (item) => ({
      ...item,
      filename,
      state: item.state.status === "error" ? { status: "staged" } : item.state,
    }))
  }

  function setIngestion(id: string, ingestionClass: UploadIngestionChoice) {
    update(id, (item) => ({ ...item, ingestionClass }))
  }

  function setIngestionForAll(ingestionClass: UploadIngestionChoice) {
    setItems((current) =>
      current.map((item) =>
        item.state.status === "done" ? item : { ...item, ingestionClass }
      )
    )
  }

  function clearFinished() {
    setItems((current) =>
      current.filter((item) => item.state.status !== "done")
    )
  }

  function reset() {
    setItems([])
  }

  async function requestIngestion(
    datasetMfid: string,
    item: UploadItem,
    file: WorkspaceDatasetFile,
    checkExisting: boolean
  ) {
    const scenario = fixtureScenarioFromScope(scope)
    try {
      if (checkExisting) {
        const page = await queryClient.fetchQuery({
          ...datasetIngestionRequestsQueryOptions(scope, datasetMfid),
          staleTime: 0,
        })
        if (page.items.some((request) => request.fileMfid === file.mfid)) {
          return "requested" as const
        }
      }
      unwrapHubResult(
        await requestWorkspaceIngestion({
          data: {
            fileMfid: file.mfid,
            ...(item.ingestionClass
              ? { ingestionClass: item.ingestionClass }
              : {}),
            scenario,
          },
        })
      )
      return "requested" as const
    } catch (error) {
      return {
        message: errorMessage(error, "Ingestion could not be requested."),
      }
    } finally {
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: crucibleKeys.datasetIngestionRequests(scope, datasetMfid),
      })
    }
  }

  async function retryIngestion(datasetMfid: string, id: string) {
    const item = items.find((candidate) => candidate.id === id)
    if (item?.state.status !== "done") return
    const ingestion = await requestIngestion(
      datasetMfid,
      item,
      item.state.file,
      true
    )
    setState(id, { ...item.state, ingestion })
  }

  async function start(datasetMfid: string): Promise<boolean> {
    if (uploading) return false
    const current = new AbortController()
    controller.current = current
    setUploading(true)
    const scenario = fixtureScenarioFromScope(scope)
    let complete = true
    for (const item of items) {
      if (item.state.status === "done") continue
      if (isAborted(current.signal)) {
        complete = false
        break
      }
      if (uploadItemIssues(item, items, existingFilenames).length > 0) {
        complete = false
        continue
      }
      try {
        const file = await uploadDatasetFile({
          datasetMfid,
          file: item.file,
          filename: item.filename,
          onProgress: (progress) => {
            if (
              progress.phase === "hashing" ||
              progress.phase === "uploading"
            ) {
              setState(item.id, {
                bytes: progress.bytes,
                status: progress.phase,
              })
            } else if (progress.phase === "completing") {
              setState(item.id, { status: "completing" })
            }
          },
          scenario,
          signal: current.signal,
        })
        setState(item.id, { file, status: "done" })
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: crucibleKeys.datasetFiles(scope, datasetMfid),
        })
        if (ingestionEnabled && item.ingestionClass !== NO_INGESTION) {
          const ingestion = await requestIngestion(
            datasetMfid,
            item,
            file,
            false
          )
          setState(item.id, { file, ingestion, status: "done" })
          if (ingestion !== "requested") complete = false
        }
      } catch (error) {
        complete = false
        if (isAborted(current.signal)) {
          setState(item.id, { status: "aborted" })
          break
        }
        setState(item.id, {
          message:
            error instanceof HubApiClientError
              ? error.message
              : errorMessage(error, "The upload failed."),
          status: "error",
        })
      }
    }
    controller.current = null
    setUploading(false)
    return complete
  }

  function cancel() {
    controller.current?.abort()
  }

  const pending = items.filter((item) => item.state.status !== "done")
  const blocked = pending.some(
    (item) => uploadItemIssues(item, items, existingFilenames).length > 0
  )
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0)
  const transferredBytes = items.reduce(
    (sum, item) =>
      sum +
      (item.state.status === "done" || item.state.status === "completing"
        ? item.file.size
        : item.state.status === "uploading"
          ? item.state.bytes
          : 0),
    0
  )

  return {
    add,
    blocked,
    cancel,
    clearFinished,
    existingFilenames,
    ingestionEnabled,
    items,
    leaveGuard,
    pendingCount: pending.length,
    remove,
    rename,
    reset,
    retryIngestion,
    setIngestion,
    setIngestionForAll,
    start,
    totalBytes,
    transferredBytes,
    uploading,
  }
}

export type UploadBatch = ReturnType<typeof useUploadBatch>
