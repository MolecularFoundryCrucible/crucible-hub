import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  AddMetadataFieldIcon,
  RemoveMetadataFieldIcon,
  UploadMetadataIcon,
} from "@/components/crucible/icons"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import {
  scientificMetadataValidationError,
  updateWorkspaceResourceMetadata,
} from "@/data/crucible/resources.functions"
import { unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceScientificMetadata } from "@/data/crucible/workspace-source"
import {
  mergeScientificMetadataUpdate,
  parseScientificMetadata,
} from "@/features/resource-metadata/scientific-metadata-form"

export type CreationMetadataRow = { id: string; name: string; value: string }

export type CreationMetadataDraft = {
  json: string
  mode: "fields" | "json"
  rows: CreationMetadataRow[]
}

type MetadataResult =
  | { metadata: WorkspaceScientificMetadata | null; ok: true }
  | { message: string; ok: false }

const numberPattern = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/

export function emptyCreationMetadata(): CreationMetadataDraft {
  return { json: "{}", mode: "fields", rows: [] }
}

function newRow(name = "", value = ""): CreationMetadataRow {
  return { id: crypto.randomUUID(), name, value }
}

export function metadataFieldValue(raw: string) {
  const value = raw.trim()
  if (value === "true") return true
  if (value === "false") return false
  if (numberPattern.test(value)) return Number(value)
  return value
}

function rowsMetadata(rows: readonly CreationMetadataRow[]): MetadataResult {
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

export function creationMetadataResult(
  draft: CreationMetadataDraft
): MetadataResult {
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
): CreationMetadataRow[] | null {
  const rows: CreationMetadataRow[] = []
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

function draftFromMetadata(
  metadata: WorkspaceScientificMetadata
): CreationMetadataDraft {
  const json = JSON.stringify(metadata, null, 2)
  const rows = fieldRows(metadata)
  return rows
    ? { json, mode: "fields", rows }
    : { json, mode: "json", rows: [] }
}

export const creationMetadataSchema = z
  .object({
    json: z.string(),
    mode: z.enum(["fields", "json"]),
    rows: z.array(
      z.object({ id: z.string(), name: z.string(), value: z.string() })
    ),
  })
  .superRefine((draft, context) => {
    const result = creationMetadataResult(draft)
    if (!result.ok)
      context.addIssue({ code: "custom", message: result.message })
  })

const modeOptions = [
  { label: "Fields", value: "fields" },
  { label: "JSON", value: "json" },
] as const

export function CreationMetadataField({
  disabled,
  errors,
  onChange,
  value,
}: {
  disabled: boolean
  errors: React.ComponentProps<typeof FieldError>["errors"]
  onChange: (value: CreationMetadataDraft) => void
  value: CreationMetadataDraft
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string>()
  const [uploaded, setUploaded] = useState<WorkspaceScientificMetadata>()
  const current = creationMetadataResult(value)
  const hasContent = !current.ok || current.metadata !== null

  function changeMode(mode: CreationMetadataDraft["mode"]) {
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

  function updateRow(id: string, change: Partial<CreationMetadataRow>) {
    onChange({
      ...value,
      rows: value.rows.map((row) =>
        row.id === id ? { ...row, ...change } : row
      ),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          ariaLabel="Metadata editor"
          onValueChange={changeMode}
          options={modeOptions}
          value={value.mode}
        />
        <Button
          disabled={disabled}
          onClick={() => fileInput.current?.click()}
          type="button"
          variant="outline"
        >
          <UploadMetadataIcon data-icon="inline-start" />
          Upload JSON
        </Button>
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
      </div>
      {value.mode === "fields" ? (
        <div className="flex flex-col gap-2">
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
                    variant="ghost"
                  >
                    <RemoveMetadataFieldIcon aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <Button
              disabled={disabled}
              onClick={() =>
                onChange({ ...value, rows: [...value.rows, newRow()] })
              }
              type="button"
              variant="outline"
            >
              <AddMetadataFieldIcon data-icon="inline-start" />
              Add field
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label="Scientific metadata JSON"
            className="h-metadata-editor-height resize-y font-mono text-supporting"
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...value, json: event.target.value })
            }
            spellCheck={false}
            value={value.json}
          />
        </div>
      )}
      {notice ? (
        <p className="text-supporting text-destructive" role="status">
          {notice}
        </p>
      ) : null}
      <FieldError errors={errors} />
      <ConfirmationDialog
        confirmLabel="Replace"
        description="Replace the metadata you entered with the file, or merge the file into it. When both have a field, the file's value wins."
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

export function useCreationMetadataSubmission({
  resourceKind,
  scope,
}: {
  resourceKind: "dataset" | "sample"
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const completed = useRef(false)
  const [failed, setFailed] = useState(false)
  const mutation = useMutation({
    mutationFn: async ({
      metadata,
      resourceMfid,
    }: {
      metadata: WorkspaceScientificMetadata
      resourceMfid: string
    }) =>
      unwrapHubResult(
        await updateWorkspaceResourceMetadata({
          data: {
            resourceKind,
            resourceMfid,
            scenario: fixtureScenarioFromScope(scope),
            update: { kind: "replace", metadata },
          },
        })
      ),
  })

  async function apply(resourceMfid: string, draft: CreationMetadataDraft) {
    const result = creationMetadataResult(draft)
    if (completed.current || !result.ok || !result.metadata) {
      setFailed(false)
      return true
    }
    try {
      const saved = await mutation.mutateAsync({
        metadata: result.metadata,
        resourceMfid,
      })
      completed.current = true
      queryClient.setQueryData(
        resourceQueryOptions(scope, resourceMfid).queryKey,
        (current) =>
          mergeScientificMetadataUpdate(current, saved.scientific_metadata)
      )
      setFailed(false)
      return true
    } catch {
      setFailed(true)
      return false
    }
  }

  return { apply, failed, isPending: mutation.isPending }
}
