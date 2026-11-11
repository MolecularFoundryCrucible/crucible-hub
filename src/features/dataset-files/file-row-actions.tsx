import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import {
  CredentialActionsIcon,
  RemoveFileIcon,
  RenameFileIcon,
} from "@/components/crucible/icons"
import { notifySuccess } from "@/components/crucible/notifications"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  removeDatasetFileFn,
  renameDatasetFileFn,
} from "@/data/crucible/dataset-file-actions.functions"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type { WorkspaceDatasetFile } from "@/data/crucible/workspace-source"

export type FileRowPermissions = {
  canRemove: boolean
  canRename: boolean
  datasetMfid: string
}

const fileErrorMessages: Partial<Record<string, string>> = {
  filename_exists: "Another file in this dataset already has that name.",
  filename_immutable:
    "This file isn't stored in Crucible, so its name can't change.",
  pending_deletion:
    "This dataset has a deletion request, so its files can't change.",
}

function fileActionError(error: unknown, fallback: string) {
  const code =
    error instanceof HubApiClientError ? error.details.conflictCode : undefined
  return (code && fileErrorMessages[code]) ?? hubErrorMessage(error, fallback)
}

function canRenameFile(file: WorkspaceDatasetFile) {
  return file.storage_backend === "gcs"
}

export function FileRowActions({
  file,
  permissions,
}: {
  file: WorkspaceDatasetFile
  permissions: FileRowPermissions
}) {
  const scope = useWorkspaceScope()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<"remove" | "rename">()
  const [name, setName] = useState(file.filename)
  const [error, setError] = useState<string>()
  const renamable = permissions.canRename && canRenameFile(file)
  const refresh = () =>
    Promise.all(
      [
        crucibleKeys.datasetFiles(scope, permissions.datasetMfid),
        crucibleKeys.datasetIngestionRequests(scope, permissions.datasetMfid),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
    )
  const rename = useMutation({
    mutationFn: async (filename: string) =>
      unwrapHubResult(
        await renameDatasetFileFn({
          data: {
            fileMfid: file.mfid,
            filename,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
    onSuccess: async () => {
      await refresh()
      setDialog(undefined)
      notifySuccess("File renamed")
    },
    onError: (cause) =>
      setError(fileActionError(cause, "The file could not be renamed.")),
  })
  const remove = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await removeDatasetFileFn({
          data: {
            fileMfid: file.mfid,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
    onSuccess: async () => {
      await refresh()
      setDialog(undefined)
      notifySuccess("File removed from the dataset")
    },
    onError: (cause) =>
      setError(fileActionError(cause, "The file could not be removed.")),
  })

  if (!renamable && !permissions.canRemove) return null
  const trimmed = name.trim()
  const pending = rename.isPending || remove.isPending

  function open(next: "remove" | "rename") {
    setError(undefined)
    setName(file.filename)
    setDialog(next)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${file.filename}`}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <CredentialActionsIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
            {renamable ? (
              <DropdownMenuItem onClick={() => open("rename")}>
                <RenameFileIcon aria-hidden="true" />
                Rename
              </DropdownMenuItem>
            ) : null}
            {permissions.canRemove ? (
              <DropdownMenuItem
                onClick={() => open("remove")}
                variant="destructive"
              >
                <RemoveFileIcon aria-hidden="true" />
                Remove
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationDialog
        confirmDisabled={!trimmed || trimmed === file.filename}
        confirmLabel="Save"
        description={file.filename}
        error={error}
        onConfirm={() => {
          if (trimmed && trimmed !== file.filename && !pending) {
            setError(undefined)
            rename.mutate(trimmed)
          }
        }}
        onOpenChange={(next) => {
          if (!pending && !next) setDialog(undefined)
        }}
        open={dialog === "rename"}
        pending={rename.isPending}
        pendingLabel="Renaming file"
        title="Rename file"
      >
        <Field>
          <FieldLabel htmlFor={`rename-${file.mfid}`}>Name</FieldLabel>
          <Input
            autoComplete="off"
            id={`rename-${file.mfid}`}
            maxLength={1024}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
      </ConfirmationDialog>
      <ConfirmationDialog
        confirmLabel="Remove"
        description="The file and its ingestion history leave this dataset. Its stored copy is cleaned up later."
        error={error}
        kind="alert"
        onConfirm={() => {
          if (!pending) {
            setError(undefined)
            remove.mutate()
          }
        }}
        onOpenChange={(next) => {
          if (!pending && !next) setDialog(undefined)
        }}
        open={dialog === "remove"}
        pending={remove.isPending}
        pendingLabel="Removing file"
        title={`Remove ${file.filename}?`}
        variant="destructive"
      />
    </>
  )
}
