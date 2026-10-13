import { memo, useCallback, useId, useRef, useState } from "react"

import {
  AddFilesIcon,
  AddFolderIcon,
  ClearFinishedUploadsIcon,
  CloseIcon,
  DropFilesIcon,
  RetryIngestionIcon,
  RenameUploadIcon,
  UploadCompleteIcon,
  UploadFailureIcon,
} from "@/components/crucible/icons"
import { MfidText } from "@/components/crucible/mfid-text"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  IngestorSelect,
  ingestorChoiceLabel,
  sameIngestorChoice,
  useIngestorClasses,
} from "@/features/ingestion/ingestor-select"
import type { IngestorChoice } from "@/features/ingestion/ingestor-select"
import { formatBytes } from "@/lib/format"
import { formatDuration } from "@/lib/transfer-rate"
import type { TransferEstimate } from "@/lib/transfer-rate"
import { cn } from "@/lib/utils"

import { uploadItemIssues } from "./upload-batch"
import type {
  UploadBatch,
  UploadBatchProgress,
  UploadItem,
  UploadSource,
} from "./upload-batch"

const EMPTY_CLASSES: readonly string[] = []

function readFileEntry(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => entry.file(resolve, reject))
}

function readDirectoryBatch(reader: FileSystemDirectoryReader) {
  return new Promise<FileSystemEntry[]>((resolve, reject) =>
    reader.readEntries(resolve, reject)
  )
}

async function sourcesFromEntry(
  entry: FileSystemEntry
): Promise<UploadSource[]> {
  const path = entry.fullPath.replace(/^\/+/, "")
  if (entry.isFile) {
    return [{ file: await readFileEntry(entry as FileSystemFileEntry), path }]
  }
  if (!entry.isDirectory) return []
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  const sources: UploadSource[] = []
  for (;;) {
    const batch = await readDirectoryBatch(reader)
    if (!batch.length) return sources
    for (const child of batch) sources.push(...(await sourcesFromEntry(child)))
  }
}

async function sourcesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<UploadSource[]> {
  const entries = Array.from(dataTransfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry())
  const files = Array.from(dataTransfer.files)
  if (!entries.some((entry) => entry?.isDirectory)) {
    return files.map((file) => ({ file, path: file.name }))
  }
  const sources: UploadSource[] = []
  for (const entry of entries) {
    if (entry) sources.push(...(await sourcesFromEntry(entry)))
  }
  return sources
}

function sourcesFromInput(files: FileList | null): UploadSource[] {
  return Array.from(files ?? []).map((file) => ({
    file,
    path: file.webkitRelativePath || file.name,
  }))
}

export function UploadDropZone({
  compact = false,
  disabled,
  onAdd,
}: {
  compact?: boolean
  disabled: boolean
  onAdd: (sources: UploadSource[]) => void
}) {
  const filesInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  function acceptsDrag(event: React.DragEvent) {
    return !disabled && event.dataTransfer.types.includes("Files")
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-dashed border-border transition-colors",
        compact
          ? "flex-row flex-wrap justify-between px-4 py-2"
          : "flex-col justify-center px-6 py-8 text-center",
        dragging && "border-primary bg-primary/5",
        disabled && "opacity-60"
      )}
      data-dragging={dragging || undefined}
      onDragEnter={(event) => {
        if (!acceptsDrag(event)) return
        event.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDragOver={(event) => {
        if (!acceptsDrag(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        if (disabled) return
        void sourcesFromDataTransfer(event.dataTransfer).then((sources) => {
          if (sources.length) onAdd(sources)
        })
      }}
    >
      {compact ? null : (
        <DropFilesIcon
          aria-hidden="true"
          className="size-6 text-muted-foreground"
        />
      )}
      <p className="text-body text-muted-foreground">
        {compact
          ? "Drag more files or folders here, or"
          : "Drag files or folders here, or"}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          disabled={disabled}
          onClick={() => filesInput.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <AddFilesIcon aria-hidden="true" data-icon="inline-start" />
          Choose files
        </Button>
        <Button
          disabled={disabled}
          onClick={() => folderInput.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <AddFolderIcon aria-hidden="true" data-icon="inline-start" />
          Choose folder
        </Button>
      </div>
      <input
        aria-label="Files to upload"
        disabled={disabled}
        hidden
        multiple
        onChange={(event) => {
          const sources = sourcesFromInput(event.target.files)
          if (sources.length) onAdd(sources)
          event.target.value = ""
        }}
        ref={filesInput}
        type="file"
      />
      <input
        aria-label="Folder to upload"
        disabled={disabled}
        hidden
        onChange={(event) => {
          const sources = sourcesFromInput(event.target.files)
          if (sources.length) onAdd(sources)
          event.target.value = ""
        }}
        ref={(element) => {
          folderInput.current = element
          element?.setAttribute("webkitdirectory", "")
        }}
        type="file"
      />
    </div>
  )
}

function TransferProgress({
  detail,
  label,
  max,
  value,
}: {
  detail?: string
  label: string
  max: number
  value: number
}) {
  return (
    <div className="flex items-center gap-3">
      <progress
        aria-label={label}
        className="h-1.5 min-w-0 flex-1 appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
        max={Math.max(max, 1)}
        value={value}
      />
      <span className="w-44 shrink-0 text-right text-supporting whitespace-nowrap text-muted-foreground tabular-nums">
        {detail ?? ""}
      </span>
    </div>
  )
}

function estimateText(estimate?: TransferEstimate) {
  if (!estimate) return undefined
  const rate = `${formatBytes(Math.round(estimate.bytesPerSecond))}/s`
  return estimate.secondsRemaining === undefined
    ? rate
    : `${rate} · ${formatDuration(estimate.secondsRemaining)} left`
}

function BatchProgress({ progress }: { progress: UploadBatchProgress }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-label">
          Uploaded {progress.completedFiles} of {progress.totalFiles}{" "}
          {progress.totalFiles === 1 ? "file" : "files"}
        </p>
        <p className="text-supporting text-muted-foreground tabular-nums">
          {formatBytes(progress.uploadedBytes)} of{" "}
          {formatBytes(progress.totalBytes)}
        </p>
      </div>
      <TransferProgress
        detail={estimateText(progress.estimate)}
        label="Overall upload progress"
        max={progress.totalBytes}
        value={progress.uploadedBytes}
      />
    </div>
  )
}

export function UploadFileList({
  batch,
  datasetMfid,
}: {
  batch: UploadBatch
  datasetMfid?: string
}) {
  const allIngestorId = useId()
  const [renaming, setRenaming] = useState<string>()
  const classesResult = useIngestorClasses(
    batch.ingestionEnabled && batch.items.length > 0
  )
  const classes = classesResult.data ?? EMPTY_CLASSES
  const handleRenameChange = useCallback((id: string, editing: boolean) => {
    setRenaming((current) =>
      editing ? id : current === id ? undefined : current
    )
  }, [])
  const pendingItems = batch.items.filter(
    (item) => item.state.status !== "done"
  )
  const sharedIngestor =
    pendingItems.length > 0 &&
    pendingItems.every((item) =>
      sameIngestorChoice(item.ingestor, pendingItems[0].ingestor)
    )
      ? pendingItems[0].ingestor
      : "mixed"
  const finished = batch.items.length - pendingItems.length

  if (!batch.items.length) return null

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {batch.progress ? (
        <BatchProgress progress={batch.progress} />
      ) : (
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-supporting text-muted-foreground tabular-nums">
            {batch.items.length} {batch.items.length === 1 ? "file" : "files"}
            {" · "}
            {formatBytes(batch.totalBytes)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {batch.ingestionEnabled && pendingItems.length > 0 ? (
              <>
                <label
                  className="text-supporting text-muted-foreground"
                  htmlFor={allIngestorId}
                >
                  Ingestor for all
                </label>
                <IngestorSelect
                  classes={classes}
                  id={allIngestorId}
                  onChange={batch.setIngestorForAll}
                  size="sm"
                  value={sharedIngestor}
                />
              </>
            ) : null}
            {finished ? (
              <Button
                onClick={batch.clearFinished}
                size="sm"
                type="button"
                variant="ghost"
              >
                <ClearFinishedUploadsIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Clear uploaded
              </Button>
            ) : null}
          </div>
        </div>
      )}
      <ul
        aria-label="Selected files"
        className="flex max-h-96 min-h-0 flex-col divide-y overflow-y-auto overscroll-contain rounded-lg border"
      >
        {batch.items.map((item) => (
          <UploadFileRow
            classes={classes}
            datasetMfid={datasetMfid}
            ingestionEnabled={batch.ingestionEnabled}
            issues={uploadItemIssues(
              item,
              batch.items,
              batch.existingFilenames,
              batch.filenameCounts
            )}
            item={item}
            key={item.id}
            onRemove={batch.remove}
            onRename={batch.rename}
            onRenameChange={handleRenameChange}
            onRetryIngestion={batch.retryIngestion}
            onSetIngestor={batch.setIngestor}
            renaming={renaming === item.id}
            uploading={batch.uploading}
          />
        ))}
      </ul>
    </div>
  )
}

function RowIcon({ item, invalid }: { item: UploadItem; invalid: boolean }) {
  const { status } = item.state
  if (status === "active") return <PendingIcon aria-hidden="true" />
  if (status === "done") {
    return (
      <UploadCompleteIcon aria-hidden="true" className="size-4 text-success" />
    )
  }
  if (status === "error" || invalid) {
    return (
      <UploadFailureIcon
        aria-hidden="true"
        className="size-4 text-destructive"
      />
    )
  }
  return <ResourceTypeIcon type="file" />
}

const UploadFileRow = memo(function UploadFileRowItem({
  classes,
  datasetMfid,
  ingestionEnabled,
  issues,
  item,
  onRemove,
  onRename,
  onRenameChange,
  onRetryIngestion,
  onSetIngestor,
  renaming,
  uploading,
}: {
  classes: readonly string[]
  datasetMfid?: string
  ingestionEnabled: boolean
  issues: readonly string[]
  item: UploadItem
  onRemove: (id: string) => void
  onRename: (id: string, filename: string) => void
  onRenameChange: (id: string, editing: boolean) => void
  onRetryIngestion: (datasetMfid: string, id: string) => Promise<void>
  onSetIngestor: (id: string, ingestor: IngestorChoice) => void
  renaming: boolean
  uploading: boolean
}) {
  const { state } = item
  const size = item.file.size
  const done = state.status === "done"
  const locked = uploading || done
  const editing = !locked && (renaming || issues.length > 0)

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <span className="flex h-8 w-5 shrink-0 items-center justify-center">
        <RowIcon invalid={issues.length > 0} item={item} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-h-8 items-center gap-2">
          {editing ? (
            <Input
              aria-invalid={issues.length > 0 || undefined}
              aria-label={`File name for ${item.file.name}`}
              autoFocus={renaming}
              className="h-8 min-w-0 flex-1"
              maxLength={1024}
              onBlur={() => onRenameChange(item.id, false)}
              onFocus={() => onRenameChange(item.id, true)}
              onChange={(event) => onRename(item.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "Escape") {
                  onRenameChange(item.id, false)
                }
              }}
              value={item.filename}
            />
          ) : (
            <span
              className="min-w-0 truncate font-heading text-label"
              title={item.filename}
            >
              {item.filename}
            </span>
          )}
          {!locked && !editing ? (
            <Button
              aria-label={`Rename ${item.filename}`}
              className="shrink-0"
              onClick={() => onRenameChange(item.id, true)}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <RenameUploadIcon aria-hidden="true" />
            </Button>
          ) : null}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {ingestionEnabled ? (
              locked ? (
                <span className="text-supporting text-muted-foreground">
                  {ingestorChoiceLabel(item.ingestor)}
                </span>
              ) : (
                <IngestorSelect
                  className="w-40"
                  classes={classes}
                  label={`Ingestor for ${item.filename}`}
                  onChange={(choice) => onSetIngestor(item.id, choice)}
                  size="sm"
                  value={item.ingestor}
                />
              )
            ) : null}
            {locked ? null : (
              <Button
                aria-label={`Remove ${item.filename} from the upload list`}
                onClick={() => onRemove(item.id)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <CloseIcon aria-hidden="true" />
              </Button>
            )}
          </span>
        </div>
        <RowDetail
          datasetMfid={datasetMfid}
          issues={issues}
          item={item}
          onRetryIngestion={onRetryIngestion}
          size={size}
          uploading={uploading}
        />
      </div>
    </li>
  )
})

function RowDetail({
  datasetMfid,
  issues,
  item,
  onRetryIngestion,
  size,
  uploading,
}: {
  datasetMfid?: string
  issues: readonly string[]
  item: UploadItem
  onRetryIngestion: (datasetMfid: string, id: string) => Promise<void>
  size: number
  uploading: boolean
}) {
  const { state } = item
  if (state.status === "active") {
    if (state.phase === "completing") {
      return (
        <p
          className="text-supporting text-muted-foreground tabular-nums"
          role="status"
        >
          {formatBytes(size)} · Verifying checksum
        </p>
      )
    }
    const preparing = state.preparedBytes < size
    return (
      <div className="flex flex-col gap-1">
        <TransferProgress
          detail={
            state.phase === "preparing"
              ? `Preparing ${Math.floor((state.preparedBytes / size) * 100)}%`
              : estimateText(state.estimate)
          }
          label={`Uploading ${item.filename}`}
          max={size}
          value={state.uploadedBytes}
        />
        <p className="text-supporting text-muted-foreground tabular-nums">
          {formatBytes(state.uploadedBytes)} of {formatBytes(size)}
          {preparing && state.phase === "uploading"
            ? ` · preparing ${Math.floor((state.preparedBytes / size) * 100)}%`
            : ""}
        </p>
      </div>
    )
  }
  if (state.status === "done") {
    return (
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-supporting text-muted-foreground"
        role="status"
      >
        <MfidText presentation="supporting" value={state.file.mfid} />
        <span className="tabular-nums">· {formatBytes(size)}</span>
        {state.ingestion === "requested" ? (
          <span>· Ingestion requested</span>
        ) : state.ingestion ? (
          <>
            <span className="text-destructive">
              · {state.ingestion.message}
            </span>
            {datasetMfid ? (
              <Button
                onClick={() => void onRetryIngestion(datasetMfid, item.id)}
                size="xs"
                type="button"
                variant="outline"
              >
                <RetryIngestionIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Retry ingestion
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    )
  }
  if (state.status === "error") {
    return (
      <p className="text-supporting text-destructive" role="alert">
        {state.message}
      </p>
    )
  }
  if (issues.length && !uploading) {
    return (
      <p className="text-supporting text-destructive" role="alert">
        {issues[0]}
      </p>
    )
  }
  return (
    <p className="text-supporting text-muted-foreground tabular-nums">
      {formatBytes(size)}
      {state.status === "aborted"
        ? " · Upload cancelled"
        : uploading
          ? " · Queued"
          : ""}
    </p>
  )
}
