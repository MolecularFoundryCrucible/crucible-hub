import { useId, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  AddFilesIcon,
  AddFolderIcon,
  ClearFinishedUploadsIcon,
  CloseIcon,
  DropFilesIcon,
  RetryIngestionIcon,
  UploadCompleteIcon,
  UploadFailureIcon,
} from "@/components/crucible/icons"
import { MfidText } from "@/components/crucible/mfid-text"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ingestionClassesQueryOptions } from "@/data/crucible/resources.queries"
import { formatBytes } from "@/lib/format"
import { cn } from "@/lib/utils"

import {
  AUTO_DETECT_INGESTION,
  NO_INGESTION,
  uploadItemIssues,
} from "./upload-batch"
import type {
  UploadBatch,
  UploadIngestionChoice,
  UploadItem,
  UploadSource,
} from "./upload-batch"

const NONE_VALUE = "none"
const AUTO_VALUE = "auto"
const MIXED_VALUE = "mixed"

function choiceValue(choice: UploadIngestionChoice) {
  if (choice === NO_INGESTION) return NONE_VALUE
  if (choice === AUTO_DETECT_INGESTION) return AUTO_VALUE
  return `class:${choice}`
}

function choiceFromValue(value: string): UploadIngestionChoice {
  if (value === NONE_VALUE) return NO_INGESTION
  if (value === AUTO_VALUE) return AUTO_DETECT_INGESTION
  return value.slice("class:".length)
}

function choiceLabel(choice: UploadIngestionChoice) {
  if (choice === NO_INGESTION) return "No ingestion"
  if (choice === AUTO_DETECT_INGESTION) return "Auto-detect"
  return choice
}

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
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-center transition-colors",
        compact ? "px-4 py-4" : "px-6 py-8",
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
        Drag files or folders here, or
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

function IngestionOptions({ classes }: { classes: readonly string[] }) {
  return (
    <>
      <NativeSelectOption value={NONE_VALUE}>No ingestion</NativeSelectOption>
      <NativeSelectOption value={AUTO_VALUE}>Auto-detect</NativeSelectOption>
      {classes.map((value) => (
        <NativeSelectOption key={value} value={`class:${value}`}>
          {value}
        </NativeSelectOption>
      ))}
    </>
  )
}

function UploadProgressBar({
  label,
  max,
  value,
}: {
  label: string
  max: number
  value: number
}) {
  return (
    <progress
      aria-label={label}
      className="h-1.5 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
      max={Math.max(max, 1)}
      value={value}
    />
  )
}

export function UploadFileList({
  batch,
  datasetMfid,
}: {
  batch: UploadBatch
  datasetMfid?: string
}) {
  const scope = useWorkspaceScope()
  const allIngestorId = useId()
  const classesResult = useQuery({
    ...ingestionClassesQueryOptions(scope),
    enabled: batch.ingestionEnabled && batch.items.length > 0,
  })
  const classes = classesResult.data ?? []
  const pendingChoices = new Set(
    batch.items
      .filter((item) => item.state.status !== "done")
      .map((item) => choiceValue(item.ingestionClass))
  )
  const sharedChoice =
    pendingChoices.size === 1 ? [...pendingChoices][0] : MIXED_VALUE
  const finished = batch.items.filter(
    (item) => item.state.status === "done"
  ).length

  if (!batch.items.length) return null

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-supporting text-muted-foreground tabular-nums">
          {batch.items.length} {batch.items.length === 1 ? "file" : "files"}
          {" · "}
          {formatBytes(batch.totalBytes)}
          {finished ? ` · ${finished} uploaded` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {batch.ingestionEnabled && batch.pendingCount > 0 ? (
            <div className="flex items-center gap-2">
              <label
                className="text-supporting text-muted-foreground"
                htmlFor={allIngestorId}
              >
                Ingestor for all
              </label>
              <NativeSelect
                disabled={batch.uploading}
                id={allIngestorId}
                onChange={(event) => {
                  if (event.target.value === MIXED_VALUE) return
                  batch.setIngestionForAll(choiceFromValue(event.target.value))
                }}
                size="sm"
                value={sharedChoice}
              >
                {sharedChoice === MIXED_VALUE ? (
                  <NativeSelectOption disabled value={MIXED_VALUE}>
                    Mixed
                  </NativeSelectOption>
                ) : null}
                <IngestionOptions classes={classes} />
              </NativeSelect>
            </div>
          ) : null}
          {finished && !batch.uploading ? (
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
      {batch.uploading ? (
        <UploadProgressBar
          label="Overall upload progress"
          max={batch.totalBytes}
          value={batch.transferredBytes}
        />
      ) : null}
      <ul
        aria-label="Selected files"
        className="flex max-h-96 min-h-0 flex-col divide-y overflow-y-auto overscroll-contain rounded-lg border"
      >
        {batch.items.map((item) => (
          <UploadFileRow
            batch={batch}
            classes={classes}
            datasetMfid={datasetMfid}
            item={item}
            key={item.id}
          />
        ))}
      </ul>
    </div>
  )
}

function statusText(item: UploadItem) {
  const { state } = item
  if (state.status === "hashing")
    return `Preparing ${formatBytes(state.bytes)} of ${formatBytes(item.file.size)}`
  if (state.status === "uploading")
    return `Uploading ${formatBytes(state.bytes)} of ${formatBytes(item.file.size)}`
  if (state.status === "completing") return "Verifying checksum"
  if (state.status === "aborted") return "Upload cancelled"
  if (state.status === "error") return state.message
  return undefined
}

function UploadFileRow({
  batch,
  classes,
  datasetMfid,
  item,
}: {
  batch: UploadBatch
  classes: readonly string[]
  datasetMfid?: string
  item: UploadItem
}) {
  const { state } = item
  const issues = uploadItemIssues(item, batch.items, batch.existingFilenames)
  const inFlight =
    state.status === "hashing" ||
    state.status === "uploading" ||
    state.status === "completing"
  const done = state.status === "done"
  const locked = batch.uploading || done
  const failed = state.status === "error"
  const text = statusText(item)

  return (
    <li className="flex flex-col gap-2 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <span className="flex size-5 shrink-0 items-center justify-center">
          {inFlight ? (
            <PendingIcon aria-hidden="true" />
          ) : done ? (
            <UploadCompleteIcon
              aria-hidden="true"
              className="size-4 text-success"
            />
          ) : failed || issues.length ? (
            <UploadFailureIcon
              aria-hidden="true"
              className="size-4 text-destructive"
            />
          ) : (
            <ResourceTypeIcon type="file" />
          )}
        </span>
        {done ? (
          <span
            className="min-w-0 flex-1 truncate text-body"
            title={item.filename}
          >
            {item.filename}
          </span>
        ) : (
          <Input
            aria-invalid={issues.length > 0 || undefined}
            aria-label={`File name for ${item.file.name}`}
            className="h-8 min-w-0 flex-1 basis-48"
            disabled={locked}
            maxLength={1024}
            onChange={(event) => batch.rename(item.id, event.target.value)}
            value={item.filename}
          />
        )}
        <span className="w-20 shrink-0 text-right text-supporting text-muted-foreground tabular-nums">
          {formatBytes(item.file.size)}
        </span>
        {batch.ingestionEnabled ? (
          done ? (
            <span className="w-40 shrink-0 truncate text-supporting text-muted-foreground">
              {choiceLabel(item.ingestionClass)}
            </span>
          ) : (
            <NativeSelect
              aria-label={`Ingestor for ${item.filename}`}
              className="w-40 shrink-0"
              disabled={locked}
              onChange={(event) =>
                batch.setIngestion(item.id, choiceFromValue(event.target.value))
              }
              size="sm"
              value={choiceValue(item.ingestionClass)}
            >
              <IngestionOptions classes={classes} />
            </NativeSelect>
          )
        ) : null}
        {locked ? (
          <span aria-hidden="true" className="size-7 shrink-0" />
        ) : (
          <Button
            aria-label={`Remove ${item.filename} from the upload list`}
            className="shrink-0"
            onClick={() => batch.remove(item.id)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <CloseIcon aria-hidden="true" />
          </Button>
        )}
      </div>
      {state.status === "hashing" || state.status === "uploading" ? (
        <div className="flex flex-col gap-1 pl-7">
          <UploadProgressBar
            label={`${state.status === "hashing" ? "Preparing" : "Uploading"} ${item.filename}`}
            max={item.file.size}
            value={state.bytes}
          />
          <p className="text-supporting text-muted-foreground tabular-nums">
            {text}
          </p>
        </div>
      ) : issues.length && !batch.uploading ? (
        <p className="pl-7 text-supporting text-destructive" role="alert">
          {issues[0]}
        </p>
      ) : text ? (
        <p
          className={cn(
            "pl-7 text-supporting",
            failed ? "text-destructive" : "text-muted-foreground"
          )}
          role={failed ? "alert" : "status"}
        >
          {text}
        </p>
      ) : done ? (
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-7 text-supporting text-muted-foreground"
          role="status"
        >
          <span>Uploaded as</span>
          <MfidText presentation="supporting" value={state.file.mfid} />
          {state.ingestion === "requested" ? (
            <span>· Ingestion requested</span>
          ) : state.ingestion ? (
            <>
              <span className="text-destructive">
                · {state.ingestion.message}
              </span>
              {datasetMfid ? (
                <Button
                  onClick={() =>
                    void batch.retryIngestion(datasetMfid, item.id)
                  }
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
      ) : null}
    </li>
  )
}
