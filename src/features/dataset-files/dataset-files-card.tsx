import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  PanelState,
  PanelUpdateError,
} from "@/components/crucible/collection-state"
import {
  AddFilesIcon,
  DownloadFileIcon,
  DownloadUnavailableIcon,
  PreparingDownloadIcon,
  RetryDownloadIcon,
} from "@/components/crucible/icons"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  useUploadsEnabled,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import type { SortDirection } from "@/data/crucible/collection-query"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { requestWorkspaceFileDownload } from "@/data/crucible/resources.functions"
import { datasetFilesQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceDatasetFile } from "@/data/crucible/workspace-source"
import { formatBytes } from "@/lib/format"
import { UploadFilesDialog } from "./upload-dialog"
import { PendingIcon } from "@/components/crucible/pending-icon"

export function DatasetFiles({
  canEdit,
  datasetMfid,
}: {
  canEdit: boolean
  datasetMfid: string
}) {
  const uploadsEnabled = useUploadsEnabled()
  const [uploadOpen, setUploadOpen] = useState(false)
  const scope = useWorkspaceScope()
  const filesResult = useQuery(datasetFilesQueryOptions(scope, datasetMfid))
  const files = filesResult.data
  const uploadAvailable = canEdit && uploadsEnabled
  return (
    <Card aria-busy={filesResult.isFetching}>
      <CardHeader>
        <CardTitle>Files</CardTitle>
        {uploadAvailable ? (
          <CardAction>
            <Button onClick={() => setUploadOpen(true)} type="button">
              <AddFilesIcon aria-hidden="true" data-icon="inline-start" />
              Add files
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent
        className={filesResult.isPending || files?.length ? "px-0" : undefined}
      >
        {filesResult.isPending ? (
          <FilesTablePending />
        ) : files !== undefined ? (
          <div className="flex flex-col gap-3">
            {filesResult.isError ? (
              <div className="px-4 pt-4 sm:px-6">
                <PanelUpdateError
                  description="File metadata could not be refreshed. Showing the last available data."
                  retry={() => void filesResult.refetch()}
                />
              </div>
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
      {uploadAvailable ? (
        <UploadFilesDialog
          datasetMfid={datasetMfid}
          onClose={() => setUploadOpen(false)}
          open={uploadOpen}
        />
      ) : null}
    </Card>
  )
}

function FilesTablePending() {
  return (
    <div aria-label="Loading file metadata" role="status">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Storage</TableHead>
            <TableHead className="text-right">Size</TableHead>
            <TableHead>
              <span className="sr-only">File action</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }, (_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-5 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-4 w-12" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto size-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

type FileSortField = "name" | "storage" | "size"

const fileNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

function compareFiles(
  left: WorkspaceDatasetFile,
  right: WorkspaceDatasetFile,
  field: FileSortField
) {
  if (field === "size") return left.size - right.size
  if (field === "storage") {
    const storage = fileNameCollator.compare(
      left.storage_backend,
      right.storage_backend
    )
    if (storage !== 0) return storage
  }
  return fileNameCollator.compare(left.filename, right.filename)
}

export function FilesTable({
  files,
}: {
  files: readonly WorkspaceDatasetFile[]
}) {
  const scope = useWorkspaceScope()
  const identity = JSON.stringify(scope)
  const scenario = fixtureScenarioFromScope(scope)
  const [sort, setSort] = useState<{
    direction: SortDirection
    field: FileSortField
  }>({ direction: "asc", field: "name" })
  const sortedFiles = useMemo(() => {
    const factor = sort.direction === "asc" ? 1 : -1
    return [...files].sort(
      (left, right) => factor * compareFiles(left, right, sort.field)
    )
  }, [files, sort])
  const onSortChange = (field: FileSortField, direction: SortDirection) =>
    setSort({ direction, field })
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            active={sort.field === "name"}
            direction={sort.direction}
            field="name"
            label="Filename"
            onChange={onSortChange}
          />
          <SortableTableHead
            active={sort.field === "storage"}
            direction={sort.direction}
            field="storage"
            label="Storage"
            onChange={onSortChange}
            preferredDirection="asc"
          />
          <SortableTableHead
            active={sort.field === "size"}
            className="text-right"
            direction={sort.direction}
            field="size"
            label="Size"
            onChange={onSortChange}
          />
          <TableHead className="text-right">
            <span className="sr-only">File action</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedFiles.map((file) => (
          <TableRow key={file.mfid}>
            <TableCell>
              <ResourceIdentity
                kind="file"
                name={file.filename}
                presentation="collection"
              />
            </TableCell>
            <TableCell>{file.storage_backend}</TableCell>
            <TableCell className="text-right tabular-nums">
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
            {pending ? (
              <PendingIcon data-icon="inline-start" />
            ) : (
              <ActionIcon aria-hidden="true" data-icon="inline-start" />
            )}
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
