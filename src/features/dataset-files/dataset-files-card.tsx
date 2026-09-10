import { useLayoutEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  CollectionRowsPending,
  PanelState,
  PanelUpdateError,
} from "@/components/crucible/collection-state"
import {
  DownloadFileIcon,
  DownloadUnavailableIcon,
  PreparingDownloadIcon,
  RetryDownloadIcon,
} from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { requestWorkspaceFileDownload } from "@/data/crucible/resources.functions"
import { datasetFilesQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceDatasetFile } from "@/data/crucible/workspace-source"
import { formatBytes } from "@/lib/format"
import { cn } from "@/lib/utils"

export function DatasetFiles({ datasetMfid }: { datasetMfid: string }) {
  const scope = useWorkspaceScope()
  const filesResult = useQuery(datasetFilesQueryOptions(scope, datasetMfid))
  const files = filesResult.data
  return (
    <Card aria-busy={filesResult.isFetching}>
      <CardHeader>
        <CardTitle>Files</CardTitle>
      </CardHeader>
      <CardContent className={files?.length ? "px-0" : undefined}>
        {filesResult.isPending ? (
          <CollectionRowsPending label="file metadata" />
        ) : files !== undefined ? (
          <div className="flex flex-col gap-3">
            {filesResult.isError ? (
              <div className="px-4 pt-4 sm:px-6">
                <PanelUpdateError
                  description="File metadata could not be refreshed. Showing the last available data."
                  retry={() => void filesResult.refetch()}
                />
              </div>
            ) : filesResult.isFetching ? (
              <p
                className="px-4 pt-4 text-supporting text-muted-foreground sm:px-6"
                role="status"
              >
                Refreshing file metadata…
              </p>
            ) : null}
            {files.length ? (
              <FilesTable files={files} />
            ) : (
              <PanelState
                description="No file records are attached to this dataset."
                title="No associated files"
              />
            )}
          </div>
        ) : (
          <PanelState
            retry={() => void filesResult.refetch()}
            role="alert"
            title="File metadata could not be loaded"
          />
        )}
      </CardContent>
    </Card>
  )
}

export function FilesTable({
  files,
}: {
  files: readonly WorkspaceDatasetFile[]
}) {
  const scope = useWorkspaceScope()
  const identity = JSON.stringify(scope)
  const scenario = fixtureScenarioFromScope(scope)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Filename</TableHead>
          <TableHead className="text-center">Storage</TableHead>
          <TableHead className="text-center">Size</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">File action</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => (
          <TableRow key={file.mfid}>
            <TableCell>
              <span className="block truncate" title={file.filename}>
                {file.filename}
              </span>
            </TableCell>
            <TableCell className="text-center">
              {file.storage_backend}
            </TableCell>
            <TableCell className="text-center tabular-nums">
              {formatBytes(file.size)}
            </TableCell>
            <TableCell className="text-right">
              <FileDownloadAction
                file={file}
                identity={identity}
                scenario={scenario}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

type FileDownloadState =
  | { status: "idle" }
  | { status: "pending" }
  | { reference?: string; status: "error" }
  | { status: "unavailable" }

export function FileDownloadAction({
  file,
  identity,
  scenario,
}: {
  file: WorkspaceDatasetFile
  identity: string
  scenario: ReturnType<typeof fixtureScenarioFromScope>
}) {
  const [state, setState] = useState<FileDownloadState>({ status: "idle" })
  const target = `${identity}\0${file.mfid}`
  const committedTarget = useRef(target)
  const request = useRef<{
    controller: AbortController
    target: string
  } | null>(null)
  const supported = file.storage_backend === "gcs"

  useLayoutEffect(() => {
    committedTarget.current = target
    setState({ status: "idle" })
    request.current = null
    return () => {
      const activeRequest = request.current
      if (activeRequest?.target !== target) return
      activeRequest.controller.abort()
      if (request.current === activeRequest) request.current = null
    }
  }, [target])

  async function download() {
    request.current?.controller.abort()
    const controller = new AbortController()
    const activeRequest = { controller, target }
    request.current = activeRequest
    setState({ status: "pending" })
    try {
      const result = unwrapHubResult(
        await requestWorkspaceFileDownload({
          data: { fileMfid: file.mfid, scenario },
          signal: controller.signal,
        })
      )
      if (
        controller.signal.aborted ||
        request.current !== activeRequest ||
        committedTarget.current !== target
      )
        return
      if (result.status === "unavailable") {
        setState({ status: "unavailable" })
        return
      }
      initiateFileDownload(result.url)
      setState({ status: "idle" })
    } catch (error) {
      if (
        controller.signal.aborted ||
        request.current !== activeRequest ||
        committedTarget.current !== target
      )
        return
      setState({
        status: "error",
        ...(error instanceof HubApiClientError
          ? { reference: error.details.correlationId }
          : {}),
      })
    }
  }

  const unavailable = !supported || state.status === "unavailable"
  const pending = state.status === "pending"
  const error = state.status === "error"
  const actionLabel = pending
    ? `Preparing download for ${file.filename}`
    : error
      ? `Retry download for ${file.filename}`
      : unavailable
        ? `Download unavailable for ${file.filename}`
        : `Download ${file.filename}`
  const ActionIcon = pending
    ? PreparingDownloadIcon
    : error
      ? RetryDownloadIcon
      : unavailable
        ? DownloadUnavailableIcon
        : DownloadFileIcon

  return (
    <>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <Button
            aria-busy={pending}
            aria-label={actionLabel}
            disabled={pending || unavailable}
            onClick={pending || unavailable ? undefined : () => void download()}
            size="icon-sm"
            variant="outline"
          >
            <ActionIcon
              aria-hidden="true"
              className={cn(pending && "motion-safe:animate-spin")}
              data-icon="inline-start"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{actionLabel}</TooltipContent>
      </Tooltip>
      {pending || unavailable ? (
        <span className="sr-only" role="status">
          {actionLabel}
        </span>
      ) : null}
      {state.status === "error" ? (
        <span className="sr-only" role="alert">
          Download could not be prepared.
          {state.reference ? ` Reference: ${state.reference}` : ""}
        </span>
      ) : null}
    </>
  )
}

export function initiateFileDownload(url: string) {
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.referrerPolicy = "no-referrer"
  anchor.rel = "noopener noreferrer"
  anchor.target = "_self"
  anchor.click()
}
