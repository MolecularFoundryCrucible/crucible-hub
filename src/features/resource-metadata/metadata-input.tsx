import { useCallback, useRef, useState } from "react"
import { z } from "zod"

import {
  AddMetadataFieldIcon,
  FormatJsonIcon,
  RemoveMetadataFieldIcon,
  UploadMetadataIcon,
} from "@/components/crucible/icons"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { JsonEditor } from "@/components/crucible/json-editor"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { scientificMetadataValidationError } from "@/data/crucible/resources.functions"
import type { WorkspaceScientificMetadata } from "@/data/crucible/workspace-source"
import { parseScientificMetadata } from "./scientific-metadata-parse"

export type MetadataRow = { id: string; name: string; value: string }

export type MetadataDraft = {
  json: string
  mode: "fields" | "json"
  rows: MetadataRow[]
}

export type MetadataDraftResult =
  | { metadata: WorkspaceScientificMetadata | null; ok: true }
  | { message: string; ok: false }

const numberPattern = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/
const fieldModeLimit = 30

export function emptyMetadataDraft(): MetadataDraft {
  return { json: "{}", mode: "fields", rows: [] }
}

function newRow(name = "", value = ""): MetadataRow {
  return { id: crypto.randomUUID(), name, value }
}

export function metadataFieldValue(raw: string) {
  const value = raw.trim()
  if (value === "true") return true
  if (value === "false") return false
  if (numberPattern.test(value)) return Number(value)
  return value
}

function rowsMetadata(rows: readonly MetadataRow[]): MetadataDraftResult {
  const metadata: Record<string, string | number | boolean> = {}
  for (const row of rows) {
    const name = row.name.trim()
    if (!name && !row.value.trim()) continue
    if (!name) return { message: "Give every field a name.", ok: false }
    if (Object.hasOwn(metadata, name)) {
      return {
        message: `The field "${name}" appears more than once.`,
        ok: false,
      }
    }
    metadata[name] = metadataFieldValue(row.value)
  }
  if (Object.keys(metadata).length === 0) return { metadata: null, ok: true }
  const error = scientificMetadataValidationError(metadata)
  return error ? { message: error, ok: false } : { metadata, ok: true }
}

export function metadataDraftResult(draft: MetadataDraft): MetadataDraftResult {
  if (draft.mode === "fields") return rowsMetadata(draft.rows)
  if (!draft.json.trim()) return { metadata: null, ok: true }
  const parsed = parseScientificMetadata(draft.json)
  if (!parsed.ok) return parsed
  return {
    metadata: Object.keys(parsed.metadata).length ? parsed.metadata : null,
    ok: true,
  }
}

function fieldRows(
  metadata: WorkspaceScientificMetadata
): MetadataRow[] | null {
  const rows: MetadataRow[] = []
  for (const [name, value] of Object.entries(metadata)) {
    const text =
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? String(value)
        : null
    if (text === null || metadataFieldValue(text) !== value) return null
    rows.push(newRow(name, text))
  }
  return rows
}

export function draftFromMetadata(
  metadata: WorkspaceScientificMetadata | null
): MetadataDraft {
  const value = metadata ?? {}
  const json = JSON.stringify(value, null, 2)
  const rows =
    Object.keys(value).length <= fieldModeLimit ? fieldRows(value) : null
  return rows
    ? { json, mode: "fields", rows }
    : { json, mode: "json", rows: [] }
}

function metadataJsonError(text: string) {
  const parsed = parseScientificMetadata(text)
  return parsed.ok ? null : parsed.message
}

export const metadataDraftSchema = z
  .object({
    json: z.string(),
    mode: z.enum(["fields", "json"]),
    rows: z.array(
      z.object({ id: z.string(), name: z.string(), value: z.string() })
    ),
  })
  .superRefine((draft, context) => {
    const result = metadataDraftResult(draft)
    if (!result.ok)
      context.addIssue({ code: "custom", message: result.message })
  })

const modeOptions = [
  { label: "Fields", value: "fields" },
  { label: "JSON", value: "json" },
] as const

export function MetadataInput({
  disabled,
  invalid,
  onChange,
  value,
}: {
  disabled: boolean
  invalid?: boolean
  onChange: (value: MetadataDraft) => void
  value: MetadataDraft
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string>()
  const [uploaded, setUploaded] = useState<WorkspaceScientificMetadata>()
  const current = metadataDraftResult(value)
  const hasContent = !current.ok || current.metadata !== null
  const formattable =
    value.mode === "json" && parseScientificMetadata(value.json).ok
  const latest = useRef(value)
  latest.current = value
  const updateJson = useCallback(
    (json: string) => onChange({ ...latest.current, json }),
    [onChange]
  )

  function changeMode(mode: MetadataDraft["mode"]) {
    setNotice(undefined)
    if (mode === value.mode) return
    if (mode === "json") {
      const result = rowsMetadata(value.rows)
      onChange({
        ...value,
        json: JSON.stringify(result.ok ? (result.metadata ?? {}) : {}, null, 2),
        mode,
      })
      return
    }
    const parsed = value.json.trim()
      ? parseScientificMetadata(value.json)
      : ({ metadata: {}, ok: true } as const)
    if (!parsed.ok) {
      setNotice("Fix the JSON before switching to fields.")
      return
    }
    const rows = fieldRows(parsed.metadata)
    if (!rows) {
      setNotice(
        "This metadata has nested values or values whose type fields cannot keep, so it stays in JSON."
      )
      return
    }
    onChange({ ...value, mode, rows })
  }

  async function readFile(file: File) {
    setNotice(undefined)
    const parsed = parseScientificMetadata(await file.text())
    if (!parsed.ok) {
      setNotice(`${file.name} could not be used. ${parsed.message}`)
      return
    }
    if (hasContent) {
      setUploaded(parsed.metadata)
      return
    }
    onChange(draftFromMetadata(parsed.metadata))
  }

  function applyUpload(kind: "merge" | "replace") {
    if (!uploaded) return
    const existing = current.ok ? (current.metadata ?? {}) : {}
    onChange(
      draftFromMetadata(
        kind === "merge" ? { ...existing, ...uploaded } : uploaded
      )
    )
    setUploaded(undefined)
  }

  function updateRow(id: string, change: Partial<MetadataRow>) {
    onChange({
      ...value,
      rows: value.rows.map((row) =>
        row.id === id ? { ...row, ...change } : row
      ),
    })
  }

  const uploadButton = (
    <Button
      disabled={disabled}
      onClick={() => fileInput.current?.click()}
      type="button"
      variant="outline"
    >
      <UploadMetadataIcon aria-hidden="true" data-icon="inline-start" />
      Upload JSON
    </Button>
  )

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        ariaLabel="Metadata editor"
        onValueChange={changeMode}
        options={modeOptions}
        value={value.mode}
      />
      <input
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void readFile(file)
        }}
        ref={fileInput}
        tabIndex={-1}
        type="file"
      />
      {value.mode === "fields" ? (
        <>
          {value.rows.length > 0 ? (
            <ul aria-label="Metadata fields" className="flex flex-col gap-2">
              {value.rows.map((row, index) => (
                <li className="flex items-center gap-2" key={row.id}>
                  <Input
                    aria-label={`Field ${index + 1} name`}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRow(row.id, { name: event.target.value })
                    }
                    placeholder="Name"
                    value={row.name}
                  />
                  <Input
                    aria-label={`Field ${index + 1} value`}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRow(row.id, { value: event.target.value })
                    }
                    placeholder="Value"
                    value={row.value}
                  />
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          aria-label={`Remove field ${index + 1}`}
                          disabled={disabled}
                          onClick={() =>
                            onChange({
                              ...value,
                              rows: value.rows.filter(
                                (candidate) => candidate.id !== row.id
                              ),
                            })
                          }
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        />
                      }
                    >
                      <RemoveMetadataFieldIcon aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>Remove field</TooltipContent>
                  </Tooltip>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={disabled}
              onClick={() =>
                onChange({ ...value, rows: [...value.rows, newRow()] })
              }
              type="button"
              variant="outline"
            >
              <AddMetadataFieldIcon
                aria-hidden="true"
                data-icon="inline-start"
              />
              Add field
            </Button>
            {uploadButton}
          </div>
        </>
      ) : (
        <>
          <JsonEditor
            ariaLabel="Scientific metadata JSON"
            disabled={disabled}
            invalid={invalid}
            onChange={updateJson}
            validate={metadataJsonError}
            value={value.json}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={disabled || !formattable}
              onClick={() => {
                const parsed = parseScientificMetadata(value.json)
                if (parsed.ok)
                  onChange({
                    ...value,
                    json: JSON.stringify(parsed.metadata, null, 2),
                  })
              }}
              type="button"
              variant="outline"
            >
              <FormatJsonIcon aria-hidden="true" data-icon="inline-start" />
              Format
            </Button>
            {uploadButton}
          </div>
        </>
      )}
      {notice ? (
        <p className="text-supporting text-destructive" role="status">
          {notice}
        </p>
      ) : null}
      <ConfirmationDialog
        confirmLabel="Replace"
        description="Replace the current metadata with the file, or merge the file into it. When both have a field, the file's value wins."
        kind="alert"
        onConfirm={() => applyUpload("replace")}
        onOpenChange={(open) => !open && setUploaded(undefined)}
        open={uploaded !== undefined}
        secondaryAction={{
          label: "Merge",
          onClick: () => applyUpload("merge"),
        }}
        title="Use the uploaded metadata?"
      />
    </div>
  )
}
