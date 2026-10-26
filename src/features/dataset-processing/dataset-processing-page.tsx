import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { UseQueryResult } from "@tanstack/react-query"
import { lazyRouteComponent } from "@tanstack/react-router"

import {
  PanelState,
  PanelUpdateError,
} from "@/components/crucible/collection-state"
import { AddFilesIcon, RequestIngestionIcon } from "@/components/crucible/icons"
import {
  AUTO_INGESTOR,
  IngestorSelect,
  ingestorClassName,
  useIngestorClasses,
} from "@/features/ingestion/ingestor-select"
import type { IngestorChoice } from "@/features/ingestion/ingestor-select"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidText } from "@/components/crucible/mfid-text"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  useUploadsEnabled,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { StatusBadge } from "@/components/crucible/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TableColumnKind } from "@/components/ui/table"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { requestWorkspaceIngestion } from "@/data/crucible/resources.functions"
import {
  datasetFilesQueryOptions,
  datasetIngestionRequestsQueryOptions,
  resourceQueryOptions,
} from "@/data/crucible/resources.queries"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type {
  WorkspaceDatasetFile,
  WorkspaceIngestionRequest,
  WorkspaceIngestionRequestPage,
} from "@/data/crucible/workspace-source"
import {
  FileDownloadAction,
  FileOpenLink,
} from "@/features/dataset-files/dataset-files-card"
import { useExitSafeMount } from "@/hooks/use-exit-safe"
import { formatBytes } from "@/lib/format"
import { cn } from "@/lib/utils"

const UploadFilesDialog = lazyRouteComponent(
  () => import("@/features/dataset-files/upload-dialog"),
  "UploadFilesDialog"
)

export function DatasetProcessingPage({
  datasetMfid,
}: {
  datasetMfid: string
}) {
  const scope = useWorkspaceScope()
  const resourceResult = useQuery(resourceQueryOptions(scope, datasetMfid))
  const filesResult = useQuery(datasetFilesQueryOptions(scope, datasetMfid))
  const requestsResult = useQuery(
    datasetIngestionRequestsQueryOptions(scope, datasetMfid)
  )

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <FilesAndIngestionCard
        canEdit={resourceResult.data?.capabilities?.can_edit === true}
        datasetMfid={datasetMfid}
        filesResult={filesResult}
        requestsResult={requestsResult}
      />
      <Card>
        <CardHeader>
          <CardTitle>Dataset processes</CardTitle>
        </CardHeader>
        <CardContent>
          <PanelState title="No dataset processes are available" />
        </CardContent>
      </Card>
    </div>
  )
}

function FilesAndIngestionCard({
  canEdit,
  datasetMfid,
  filesResult,
  requestsResult,
}: {
  canEdit: boolean
  datasetMfid: string
  filesResult: UseQueryResult<readonly WorkspaceDatasetFile[]>
  requestsResult: UseQueryResult<WorkspaceIngestionRequestPage>
}) {
  const files = filesResult.data
  const requestPage = requestsResult.data
  const requests = requestPage?.items
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const uploadExit = useExitSafeMount(uploadOpen)
  const uploadsEnabled = useUploadsEnabled()
  const uploadAvailable = canEdit && uploadsEnabled
  const eligibleFiles = files?.filter((file) => file.storage_backend === "gcs")

  return (
    <Card aria-busy={filesResult.isFetching || requestsResult.isFetching}>
      <CardHeader>
        <CardTitle>Files and ingestion</CardTitle>
        {uploadAvailable || eligibleFiles?.length ? (
          <CardAction className="flex flex-wrap gap-2">
            {uploadAvailable ? (
              <Button
                onClick={() => setUploadOpen(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                <AddFilesIcon aria-hidden="true" data-icon="inline-start" />
                Add files
              </Button>
            ) : null}
            {eligibleFiles?.length ? (
              <Button
                onClick={() => setDialogOpen(true)}
                size="sm"
                type="button"
              >
                <RequestIngestionIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Request ingestion
              </Button>
            ) : null}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col px-0">
        <section aria-labelledby="processing-files-heading">
          <h3 className="sr-only" id="processing-files-heading">
            Files
          </h3>
          {filesResult.isPending || requestsResult.isPending ? (
            <ProcessingTablePending
              kinds={[
                "text",
                "text",
                "numeric",
                "text",
                "text",
                "date",
                "action",
              ]}
              className="table-fixed"
              mdOnly={[4, 5]}
              wideOnly={[1, 2]}
              colgroup={<ProcessingFilesColumns />}
              columns={[
                "File",
                "Storage",
                "Size",
                "Status",
                "Ingestor",
                "Updated",
                "",
              ]}
              label="file processing information"
            />
          ) : files !== undefined && requests !== undefined ? (
            <>
              {filesResult.isError || requestsResult.isError ? (
                <div className="mb-4 px-4 sm:px-6">
                  <PanelUpdateError
                    description={hubErrorMessage(
                      filesResult.error ?? requestsResult.error,
                      "Some processing information could not be refreshed."
                    )}
                    retry={() => {
                      void filesResult.refetch()
                      void requestsResult.refetch()
                    }}
                  />
                </div>
              ) : null}
              {files.length ? (
                <ProcessingFilesTable
                  historyComplete={
                    (requestPage?.total ?? requests.length) <= requests.length
                  }
                  files={files}
                  requests={requests}
                />
              ) : (
                <PanelState title="No associated files" />
              )}
            </>
          ) : (
            <PanelState
              description={hubErrorMessage(
                filesResult.error ?? requestsResult.error,
                "Try again or share the request reference if the problem continues."
              )}
              retry={() => {
                void filesResult.refetch()
                void requestsResult.refetch()
              }}
              role="alert"
              title="Processing information could not be loaded"
            />
          )}
        </section>
        <section
          aria-labelledby="ingestion-history-heading"
          className="bg-muted/30 py-4"
        >
          <div className="mb-3 flex items-baseline gap-2 px-4 sm:px-6">
            <h3
              className="font-heading text-label"
              id="ingestion-history-heading"
            >
              Request history
            </h3>
            {requestPage ? (
              <span className="text-supporting text-muted-foreground tabular-nums">
                {requestPage.total}
              </span>
            ) : null}
          </div>
          {requestsResult.isPending ? (
            <ProcessingTablePending
              columns={[
                "Request",
                "File MFID",
                "Status",
                "Ingestor",
                "Created",
                "Completed",
              ]}
              label="ingestion request history"
              mdOnly={[1, 3, 5]}
            />
          ) : requests !== undefined ? (
            requests.length ? (
              <IngestionRequestHistory
                requests={requests}
                total={requestPage?.total ?? requests.length}
              />
            ) : (
              <div className="px-4 sm:px-6">
                <PanelState title="No ingestion requests" />
              </div>
            )
          ) : (
            <div className="px-4 sm:px-6">
              <PanelState
                description={hubErrorMessage(
                  requestsResult.error,
                  "Try again or share the request reference if the problem continues."
                )}
                retry={() => void requestsResult.refetch()}
                role="alert"
                title="Request history could not be loaded"
              />
            </div>
          )}
        </section>
      </CardContent>
      {uploadAvailable && uploadExit.mounted ? (
        <UploadFilesDialog
          datasetMfid={datasetMfid}
          onClose={() => setUploadOpen(false)}
          onClosed={() => uploadExit.onOpenChangeComplete(false)}
          open={uploadOpen}
        />
      ) : null}
      {files?.length ? (
        <IngestionRequestDialog
          datasetMfid={datasetMfid}
          files={files}
          onOpenChange={setDialogOpen}
          open={dialogOpen}
        />
      ) : null}
    </Card>
  )
}

function ProcessingFilesColumns() {
  return (
    <colgroup>
      <col />
      <col className="hidden @4xl:table-column @4xl:w-column-compact" />
      <col className="hidden @4xl:table-column @4xl:w-column-compact" />
      <col className="w-column-label" />
      <col className="hidden @3xl:table-column @3xl:w-column-person" />
      <col className="hidden @3xl:table-column @3xl:w-column-date" />
      <col className="w-column-action" />
    </colgroup>
  )
}

function ProcessingTablePending({
  className,
  colgroup,
  columns,
  kinds = [],
  label,
  mdOnly = [],
  wideOnly = [],
}: {
  className?: string
  colgroup?: ReactNode
  columns: readonly string[]
  kinds?: readonly TableColumnKind[]
  label: string
  mdOnly?: readonly number[]
  wideOnly?: readonly number[]
}) {
  return (
    <div aria-label={`Loading ${label}`} role="status">
      <Table aria-label={label} className={className}>
        {colgroup}
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead
                className={cn(
                  mdOnly.includes(index) && "hidden @3xl:table-cell",
                  wideOnly.includes(index) && "hidden @4xl:table-cell"
                )}
                kind={kinds[index]}
                key={`${column}-${index}`}
              >
                {column || <span className="sr-only">File action</span>}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }, (_, row) => (
            <TableRow key={row}>
              {columns.map((column, columnIndex) => (
                <TableCell
                  className={cn(
                    mdOnly.includes(columnIndex) && "hidden @3xl:table-cell",
                    wideOnly.includes(columnIndex) && "hidden @4xl:table-cell"
                  )}
                  key={`${column}-${columnIndex}`}
                  kind={kinds[columnIndex]}
                >
                  <Skeleton
                    className={
                      kinds[columnIndex] === "numeric" ||
                      kinds[columnIndex] === "action"
                        ? "ml-auto h-4 w-20"
                        : "h-4 w-24 max-w-full"
                    }
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ProcessingFilesTable({
  files,
  historyComplete,
  requests,
}: {
  files: readonly WorkspaceDatasetFile[]
  historyComplete: boolean
  requests: readonly WorkspaceIngestionRequest[]
}) {
  const scope = useWorkspaceScope()
  const identity = JSON.stringify(scope)
  const scenario = fixtureScenarioFromScope(scope)
  const latestRequests = useMemo(
    () => latestRequestsByFile(requests),
    [requests]
  )

  return (
    <Table aria-label="Files and ingestion" className="table-fixed">
      <ProcessingFilesColumns />
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead className="hidden @4xl:table-cell">Storage</TableHead>
          <TableHead kind="numeric" className="hidden pr-4 @4xl:table-cell">
            Size
          </TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden @3xl:table-cell">Ingestor</TableHead>
          <TableHead className="hidden @3xl:table-cell" kind="date">
            Updated
          </TableHead>
          <TableHead kind="action">
            <span className="sr-only">File action</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => {
          const request = latestRequests.get(file.mfid)
          return (
            <TableRow key={file.mfid}>
              <TableCell className="w-full max-w-0">
                <ResourceIdentity
                  kind="file"
                  mfid={file.mfid}
                  name={file.filename}
                  nameContent={<FileOpenLink file={file} scenario={scenario} />}
                  presentation="collection"
                />
                <span className="mt-0.5 block truncate pl-6 text-supporting text-muted-foreground @4xl:hidden">
                  <span className="@3xl:hidden">
                    {request?.ingestionClass ?? "Auto-detect"} ·{" "}
                  </span>
                  {formatBytes(file.size)}
                </span>
              </TableCell>
              <TableCell className="hidden truncate @4xl:table-cell">
                {file.storage_backend}
              </TableCell>
              <TableCell kind="numeric" className="hidden pr-4 @4xl:table-cell">
                {formatBytes(file.size)}
              </TableCell>
              <TableCell>
                <IngestionStatusBadge
                  emptyLabel={
                    historyComplete ? "Not requested" : "No recent status"
                  }
                  status={request?.status}
                />
              </TableCell>
              <TableCell className="hidden truncate @3xl:table-cell">
                {request?.ingestionClass ?? "Auto-detect"}
              </TableCell>
              <TableCell className="hidden @3xl:table-cell" kind="date">
                <LocalDateTime
                  fallback="-"
                  value={request?.timeCompleted ?? request?.timeCreated}
                />
              </TableCell>
              <TableCell kind="action">
                <FileDownloadAction
                  file={file}
                  identity={identity}
                  scenario={scenario}
                />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function IngestionRequestHistory({
  requests,
  total,
}: {
  requests: readonly WorkspaceIngestionRequest[]
  total: number
}) {
  return (
    <div className="flex flex-col gap-2">
      {total > requests.length ? (
        <p className="px-4 text-supporting text-muted-foreground sm:px-6">
          Showing {requests.length} of {total}
        </p>
      ) : null}
      <Table aria-label="Ingestion requests">
        <TableHeader>
          <TableRow>
            <TableHead>Request</TableHead>
            <TableHead className="hidden @3xl:table-cell">File MFID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden @3xl:table-cell">Ingestor</TableHead>
            <TableHead kind="date">Created</TableHead>
            <TableHead className="hidden @3xl:table-cell" kind="date">
              Completed
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request, index) => (
            <TableRow
              key={request.id ?? `${request.fileMfid ?? "request"}-${index}`}
            >
              <TableCell>
                <span>{request.id ?? "-"}</span>
                <span className="mt-0.5 block truncate text-supporting text-muted-foreground @3xl:hidden">
                  {request.ingestionClass ?? "Auto-detect"}
                </span>
              </TableCell>
              <TableCell className="hidden @3xl:table-cell">
                {request.fileMfid ? <MfidText value={request.fileMfid} /> : "-"}
              </TableCell>
              <TableCell>
                <IngestionStatusBadge status={request.status} />
              </TableCell>
              <TableCell className="hidden @3xl:table-cell">
                <span>{request.ingestionClass ?? "Auto-detect"}</span>
                {request.ingestionGitHash ? (
                  <span className="block font-mono text-supporting text-muted-foreground">
                    {request.ingestionGitHash}
                  </span>
                ) : null}
              </TableCell>
              <TableCell kind="date">
                <LocalDateTime fallback="-" value={request.timeCreated} />
              </TableCell>
              <TableCell className="hidden @3xl:table-cell" kind="date">
                <LocalDateTime fallback="-" value={request.timeCompleted} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function IngestionRequestDialog({
  datasetMfid,
  files,
  onOpenChange,
  open,
}: {
  datasetMfid: string
  files: readonly WorkspaceDatasetFile[]
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const scope = useWorkspaceScope()
  const queryClient = useQueryClient()
  const scenario = fixtureScenarioFromScope(scope)
  const eligibleFiles = useMemo(
    () => files.filter((file) => file.storage_backend === "gcs"),
    [files]
  )
  const eligibleMfids = useMemo(
    () => eligibleFiles.map((file) => file.mfid),
    [eligibleFiles]
  )
  const [selectedMfids, setSelectedMfids] = useState<readonly string[]>([])
  const [ingestor, setIngestor] = useState<IngestorChoice>(AUTO_INGESTOR)
  const [error, setError] = useState<string>()
  const classesResult = useIngestorClasses(open)
  const mutation = useMutation({
    mutationFn: async (fileMfids: readonly string[]) => {
      const ingestionClass = ingestorClassName(ingestor)
      const results = await Promise.allSettled(
        fileMfids.map(async (fileMfid) =>
          unwrapHubResult(
            await requestWorkspaceIngestion({
              data: {
                fileMfid,
                ...(ingestionClass ? { ingestionClass } : {}),
                scenario,
              },
            })
          )
        )
      )
      return results.map((result, index) => ({
        fileMfid: fileMfids[index],
        result,
      }))
    },
  })

  useEffect(() => {
    if (!open) return
    setSelectedMfids(eligibleMfids)
    setIngestor(AUTO_INGESTOR)
    setError(undefined)
  }, [eligibleMfids, open])

  function updateOpen(nextOpen: boolean) {
    if (mutation.isPending) return
    onOpenChange(nextOpen)
  }

  function toggleFile(fileMfid: string, checked: boolean) {
    setSelectedMfids((current) =>
      checked
        ? [...new Set([...current, fileMfid])]
        : current.filter((candidate) => candidate !== fileMfid)
    )
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedMfids.length) {
      setError("Select at least one file.")
      return
    }
    setError(undefined)
    const outcomes = await mutation.mutateAsync(selectedMfids)
    const failures = outcomes.filter(
      (outcome) => outcome.result.status === "rejected"
    )
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: crucibleKeys.datasetIngestionRequests(scope, datasetMfid),
    })
    if (!failures.length) {
      onOpenChange(false)
      return
    }
    setSelectedMfids(failures.map((failure) => failure.fileMfid))
    const firstFailure = failures[0].result
    setError(
      firstFailure.status === "rejected" &&
        firstFailure.reason instanceof HubApiClientError
        ? firstFailure.reason.details.conflictCode ===
          "storage_location_invalid"
          ? `The stored copy of this file is not in a valid location, so it cannot be ingested. Reference: ${firstFailure.reason.details.correlationId}`
          : firstFailure.reason.message
        : `Ingestion could not be requested for ${failures.length} file${failures.length === 1 ? "" : "s"}.`
    )
  }

  const allSelected =
    eligibleMfids.length > 0 &&
    eligibleMfids.every((fileMfid) => selectedMfids.includes(fileMfid))

  return (
    <Dialog onOpenChange={updateOpen} open={open}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={!mutation.isPending}
      >
        <form className="flex min-h-0 flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Request ingestion</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ingestion-class">Ingestion class</FieldLabel>
              <IngestorSelect
                allowNone={false}
                className="w-full"
                classes={classesResult.data ?? []}
                disabled={mutation.isPending}
                id="ingestion-class"
                onChange={setIngestor}
                value={ingestor}
              />
              {classesResult.isError ? (
                <p className="text-supporting text-muted-foreground">
                  Ingestion classes could not be loaded; only Auto-detect is
                  available.
                </p>
              ) : null}
            </Field>
            <FieldSet>
              <FieldLegend>Files</FieldLegend>
              <Field orientation="horizontal">
                <Checkbox
                  checked={allSelected}
                  disabled={mutation.isPending}
                  id="ingestion-select-all"
                  onCheckedChange={(checked) =>
                    setSelectedMfids(checked ? eligibleMfids : [])
                  }
                />
                <FieldLabel htmlFor="ingestion-select-all">
                  Select all
                </FieldLabel>
              </Field>
              <div className="max-h-64 overflow-y-auto overscroll-contain pr-1">
                <FieldGroup data-slot="checkbox-group">
                  {files.map((file) => {
                    const eligible = file.storage_backend === "gcs"
                    const id = `ingestion-file-${file.mfid}`
                    return (
                      <Field
                        data-disabled={!eligible || mutation.isPending}
                        key={file.mfid}
                        orientation="horizontal"
                      >
                        <Checkbox
                          checked={selectedMfids.includes(file.mfid)}
                          disabled={!eligible || mutation.isPending}
                          id={id}
                          onCheckedChange={(checked) =>
                            toggleFile(file.mfid, checked)
                          }
                        />
                        <FieldLabel htmlFor={id}>
                          <span className="flex min-w-0 items-start gap-2">
                            <ResourceTypeIcon
                              className="mt-0.5 shrink-0"
                              type="file"
                            />
                            <FieldContent>
                              <FieldTitle>{file.filename}</FieldTitle>
                              <span className="flex flex-wrap gap-x-2 text-supporting text-muted-foreground">
                                <MfidText
                                  presentation="supporting"
                                  value={file.mfid}
                                />
                                <span>{formatBytes(file.size)}</span>
                                {!eligible ? <span>Unavailable</span> : null}
                              </span>
                            </FieldContent>
                          </span>
                        </FieldLabel>
                      </Field>
                    )
                  })}
                </FieldGroup>
              </div>
            </FieldSet>
          </FieldGroup>
          {error ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={() => updateOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={mutation.isPending || !selectedMfids.length}
              type="submit"
            >
              {mutation.isPending ? (
                <>
                  <PendingIcon data-icon="inline-start" />
                  Requesting ingestion
                </>
              ) : (
                "Request ingestion"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function latestRequestsByFile(requests: readonly WorkspaceIngestionRequest[]) {
  const latest = new Map<string, WorkspaceIngestionRequest>()
  for (const request of requests) {
    if (request.fileMfid && !latest.has(request.fileMfid)) {
      latest.set(request.fileMfid, request)
    }
  }
  return latest
}

function IngestionStatusBadge({
  emptyLabel = "Not requested",
  status,
}: {
  emptyLabel?: string
  status?: string | null
}) {
  return status?.trim() ? (
    <StatusBadge domain="ingestion" status={status} />
  ) : (
    <Badge variant="outline">{emptyLabel}</Badge>
  )
}
