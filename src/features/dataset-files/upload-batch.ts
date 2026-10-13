import { useCallback, useMemo, useRef, useState } from "react"
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
import {
  ingestorClassName,
  NO_INGESTOR,
} from "@/features/ingestion/ingestor-select"
import type { IngestorChoice } from "@/features/ingestion/ingestor-select"
import { createTransferRate } from "@/lib/transfer-rate"
import type { TransferEstimate } from "@/lib/transfer-rate"

import { uploadDatasetFile } from "./upload-orchestrator"
import type { UploadPhase } from "./upload-orchestrator"
import { useUploadLeaveGuard } from "./upload-leave-guard"

export const MAX_PARALLEL_FILES = 3
const EMPTY_ISSUES: readonly string[] = []
const EMPTY_FILENAME_SET: ReadonlySet<string> = new Set<string>()

export type UploadItemStatus =
  | { status: "staged" }
  | {
      estimate?: TransferEstimate
      phase: Exclude<UploadPhase, "done">
      preparedBytes: number
      status: "active"
      uploadedBytes: number
    }
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
  ingestor: IngestorChoice
  state: UploadItemStatus
}

export type UploadSource = { file: File; path: string }

export type UploadBatchProgress = {
  activeFiles: number
  completedFiles: number
  estimate?: TransferEstimate
  totalBytes: number
  totalFiles: number
  uploadedBytes: number
}

function isAborted(signal: AbortSignal) {
  return signal.aborted
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function uploadFilenameCounts(
  items: readonly UploadItem[]
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const entry of items) {
    counts.set(entry.filename, (counts.get(entry.filename) ?? 0) + 1)
  }
  return counts
}

export function uploadItemIssues(
  item: UploadItem,
  items: readonly UploadItem[],
  existingFilenames: ReadonlySet<string>,
  filenameCounts?: ReadonlyMap<string, number>
): readonly string[] {
  if (item.state.status === "done") return EMPTY_ISSUES
  const issues = [...validateUploadFilename(item.filename)]
  if (item.file.size === 0) issues.push("Empty files cannot be uploaded.")
  const hasDuplicate = filenameCounts
    ? (filenameCounts.get(item.filename) ?? 0) > 1
    : items.some(
        (other) => other.id !== item.id && other.filename === item.filename
      )
  if (hasDuplicate) {
    issues.push("Another file in this list has the same name.")
  }
  if (existingFilenames.has(item.filename)) {
    issues.push("A file with this name is already in the dataset.")
  }
  return issues.length > 0 ? issues : EMPTY_ISSUES
}

export function useUploadBatch({
  existingFilenames = EMPTY_FILENAME_SET,
}: { existingFilenames?: ReadonlySet<string> } = {}) {
  const scope = useWorkspaceScope()
  const ingestionEnabled = useUploadIngestionEnabled()
  const queryClient = useQueryClient()
  const [items, setItems] = useState<UploadItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadBatchProgress>()
  const controller = useRef<AbortController | null>(null)
  const leaveGuard = useUploadLeaveGuard(
    () => controller.current !== null,
    () => controller.current?.abort()
  )
  const filenameCounts = useMemo(() => uploadFilenameCounts(items), [items])

  const update = useCallback(
    (id: string, change: (item: UploadItem) => UploadItem) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? change(item) : item))
      )
    },
    []
  )

  const setState = useCallback(
    (id: string, state: UploadItemStatus) => {
      update(id, (item) => ({ ...item, state }))
    },
    [update]
  )

  const add = useCallback((sources: readonly UploadSource[]) => {
    setItems((current) => [
      ...current,
      ...sources.map((source) => ({
        file: source.file,
        filename: source.path,
        id: crypto.randomUUID(),
        ingestor: NO_INGESTOR,
        state: { status: "staged" } as const,
      })),
    ])
  }, [])

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const rename = useCallback(
    (id: string, filename: string) => {
      update(id, (item) => ({
        ...item,
        filename,
        state:
          item.state.status === "error" ? { status: "staged" } : item.state,
      }))
    },
    [update]
  )

  const setIngestor = useCallback(
    (id: string, ingestor: IngestorChoice) => {
      update(id, (item) => ({ ...item, ingestor }))
    },
    [update]
  )

  const setIngestorForAll = useCallback((ingestor: IngestorChoice) => {
    setItems((current) =>
      current.map((item) =>
        item.state.status === "done" ? item : { ...item, ingestor }
      )
    )
  }, [])

  const clearFinished = useCallback(() => {
    setItems((current) =>
      current.filter((item) => item.state.status !== "done")
    )
  }, [])

  const reset = useCallback(() => {
    setItems([])
  }, [])

  const requestIngestion = useCallback(
    async (
      datasetMfid: string,
      item: UploadItem,
      file: WorkspaceDatasetFile,
      checkExisting: boolean
    ) => {
      const scenario = fixtureScenarioFromScope(scope)
      const ingestionClass = ingestorClassName(item.ingestor)
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
              ...(ingestionClass ? { ingestionClass } : {}),
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
    },
    [queryClient, scope]
  )

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
    const queue = items.filter(
      (item) =>
        item.state.status !== "done" &&
        uploadItemIssues(item, items, existingFilenames, filenameCounts)
          .length === 0
    )
    let complete =
      queue.length ===
      items.filter((item) => item.state.status !== "done").length
    const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0)
    const transferred = new Map<string, number>()
    const overallRate = createTransferRate()
    let activeFiles = 0
    let completedFiles = 0

    const reportOverall = () => {
      let uploadedBytes = 0
      for (const bytes of transferred.values()) uploadedBytes += bytes
      setProgress({
        activeFiles,
        completedFiles,
        estimate: overallRate.update(uploadedBytes, totalBytes),
        totalBytes,
        totalFiles: queue.length,
        uploadedBytes,
      })
    }

    async function uploadItem(item: UploadItem) {
      const rate = createTransferRate()
      activeFiles += 1
      try {
        const file = await uploadDatasetFile({
          datasetMfid,
          file: item.file,
          filename: item.filename,
          onProgress: (next) => {
            if (next.phase === "done") return
            transferred.set(item.id, next.uploadedBytes)
            setState(item.id, {
              estimate:
                next.phase === "uploading"
                  ? rate.update(next.uploadedBytes, item.file.size)
                  : undefined,
              phase: next.phase,
              preparedBytes: next.preparedBytes,
              status: "active",
              uploadedBytes: next.uploadedBytes,
            })
            reportOverall()
          },
          scenario,
          signal: current.signal,
        })
        transferred.set(item.id, item.file.size)
        completedFiles += 1
        setState(item.id, { file, status: "done" })
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: crucibleKeys.datasetFiles(scope, datasetMfid),
        })
        if (ingestionEnabled && item.ingestor.kind !== "none") {
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
        transferred.delete(item.id)
        if (isAborted(current.signal)) {
          setState(item.id, { status: "aborted" })
          return
        }
        setState(item.id, {
          message:
            error instanceof HubApiClientError
              ? error.message
              : errorMessage(error, "The upload failed."),
          status: "error",
        })
      } finally {
        activeFiles -= 1
        reportOverall()
      }
    }

    let next = 0
    await Promise.all(
      Array.from(
        { length: Math.min(MAX_PARALLEL_FILES, queue.length) },
        async () => {
          while (next < queue.length && !isAborted(current.signal)) {
            const item = queue[next]
            next += 1
            await uploadItem(item)
          }
        }
      )
    )
    if (next < queue.length) complete = false

    controller.current = null
    setUploading(false)
    setProgress(undefined)
    return complete
  }

  const cancel = useCallback(() => {
    controller.current?.abort()
  }, [])

  const pending = items.filter((item) => item.state.status !== "done")
  const blocked = pending.some(
    (item) =>
      uploadItemIssues(item, items, existingFilenames, filenameCounts).length >
      0
  )
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0)

  return {
    add,
    blocked,
    cancel,
    clearFinished,
    existingFilenames,
    filenameCounts,
    ingestionEnabled,
    items,
    leaveGuard,
    pendingCount: pending.length,
    progress,
    remove,
    rename,
    reset,
    retryIngestion,
    setIngestor,
    setIngestorForAll,
    start,
    totalBytes,
    uploading,
  }
}

export type UploadBatch = ReturnType<typeof useUploadBatch>
