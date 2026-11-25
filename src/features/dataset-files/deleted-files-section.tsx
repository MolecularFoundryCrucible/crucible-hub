import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { Disclosure, DisclosureSummary } from "@/components/crucible/disclosure"
import { InlineError } from "@/components/crucible/form-error"
import {
  CredentialActionsIcon,
  PurgeFileIcon,
  RestoreFileIcon,
} from "@/components/crucible/icons"
import { LocalDateTime } from "@/components/crucible/local-date-time"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  purgeDeletedFileFn,
  restoreDeletedFileFn,
} from "@/data/crucible/deleted-files.functions"
import { deletedFilesQueryOptions } from "@/data/crucible/deleted-files.queries"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type { WorkspaceDeletedFile } from "@/data/crucible/workspace-source"
import { formatBytes } from "@/lib/format"

const restoreErrors: Partial<Record<string, string>> = {
  not_in_trash: "This file is no longer kept, so it can't be restored.",
  version_expired:
    "This file's restore period has ended and its content is being removed.",
  dataset_pending_deletion:
    "This dataset has a deletion request, so its files can't change.",
  pending_deletion:
    "This dataset has a deletion request, so its files can't change.",
  filename_exists:
    "Another file in this dataset has this name. Rename or remove it, then restore again.",
  filename_reserved:
    "An upload in progress uses this filename. Try again when it finishes.",
  version_missing_in_storage:
    "The kept content is no longer in storage, so this file can't be restored.",
  version_size_mismatch:
    "The kept content doesn't match the deleted file, so it can't be restored.",
  store_unavailable:
    "The storage holding this file isn't configured on this Crucible server.",
}

function deletedFileError(error: unknown, fallback: string) {
  const code =
    error instanceof HubApiClientError ? error.details.conflictCode : undefined
  return (code && restoreErrors[code]) ?? hubErrorMessage(error, fallback)
}

export function DeletedFilesSection({ datasetMfid }: { datasetMfid: string }) {
  const scope = useWorkspaceScope()
  const deleted = useQuery(deletedFilesQueryOptions(scope, datasetMfid))
  if (deleted.isError) {
    return (
      <InlineError className="px-4 sm:px-6" size="supporting">
        Recently deleted files could not be loaded.
      </InlineError>
    )
  }
  const files = deleted.data?.items
  if (!files?.length) return null
  return (
    <Disclosure className="border-t pt-3">
      <DisclosureSummary className="mx-4 text-label sm:mx-6">
        Recently deleted ({deleted.data?.total ?? files.length})
      </DisclosureSummary>
      <Table aria-label="Recently deleted files" className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead className="hidden @md:table-cell">
              Restorable until
            </TableHead>
            <TableHead className="hidden @md:table-cell" kind="numeric">
              Size
            </TableHead>
            <TableHead kind="action">
              <span className="sr-only">Deleted file action</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.fileMfid}>
              <TableCell className="w-full max-w-0">
                <span className="block truncate">{file.filename}</span>
                <span className="block text-supporting text-muted-foreground">
                  Deleted <LocalDateTime value={file.deletedAt} />
                </span>
                <span className="block text-supporting text-muted-foreground @md:hidden">
                  Restorable until{" "}
                  <LocalDateTime value={file.restorableUntil} />
                </span>
              </TableCell>
              <TableCell className="hidden @md:table-cell">
                <LocalDateTime value={file.restorableUntil} />
              </TableCell>
              <TableCell className="hidden @md:table-cell" kind="numeric">
                {formatBytes(file.size)}
              </TableCell>
              <TableCell kind="action">
                <DeletedFileActions datasetMfid={datasetMfid} file={file} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Disclosure>
  )
}

function DeletedFileActions({
  datasetMfid,
  file,
}: {
  datasetMfid: string
  file: WorkspaceDeletedFile
}) {
  const scope = useWorkspaceScope()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<"restore" | "purge">()
  const [error, setError] = useState<string>()
  const input = {
    datasetMfid,
    fileMfid: file.fileMfid,
    scenario: fixtureScenarioFromScope(scope),
  }
  const refresh = (keys: readonly (readonly unknown[])[]) =>
    Promise.all(
      keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
    )
  const restore = useMutation({
    mutationFn: async () =>
      unwrapHubResult(await restoreDeletedFileFn({ data: input })),
    onSuccess: async () => {
      await refresh([
        crucibleKeys.datasetDeletedFiles(scope, datasetMfid),
        crucibleKeys.datasetFiles(scope, datasetMfid),
        crucibleKeys.datasetIngestionRequests(scope, datasetMfid),
      ])
      setDialog(undefined)
      notifySuccess("File restored")
    },
    onError: (cause) =>
      setError(deletedFileError(cause, "The file could not be restored.")),
  })
  const purge = useMutation({
    mutationFn: async () =>
      unwrapHubResult(await purgeDeletedFileFn({ data: input })),
    onSuccess: async () => {
      await refresh([crucibleKeys.datasetDeletedFiles(scope, datasetMfid)])
      setDialog(undefined)
      notifySuccess("File deleted permanently")
    },
    onError: (cause) =>
      setError(deletedFileError(cause, "The file could not be deleted.")),
  })
  const pending = restore.isPending || purge.isPending

  function open(next: "restore" | "purge") {
    setError(undefined)
    setDialog(next)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for deleted ${file.filename}`}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <CredentialActionsIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => open("restore")}>
              <RestoreFileIcon aria-hidden="true" />
              Restore
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => open("purge")}
              variant="destructive"
            >
              <PurgeFileIcon aria-hidden="true" />
              Delete permanently
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationDialog
        confirmLabel="Restore"
        description="The file returns to this dataset with its name, content and ingestion history."
        error={error}
        onConfirm={() => {
          if (!pending) {
            setError(undefined)
            restore.mutate()
          }
        }}
        onOpenChange={(next) => {
          if (!pending && !next) setDialog(undefined)
        }}
        open={dialog === "restore"}
        pending={restore.isPending}
        pendingLabel="Restoring file"
        title={`Restore ${file.filename}?`}
      />
      <ConfirmationDialog
        confirmLabel="Delete permanently"
        description="The file can no longer be restored, and its content is removed at the next storage cleanup."
        error={error}
        kind="alert"
        onConfirm={() => {
          if (!pending) {
            setError(undefined)
            purge.mutate()
          }
        }}
        onOpenChange={(next) => {
          if (!pending && !next) setDialog(undefined)
        }}
        open={dialog === "purge"}
        pending={purge.isPending}
        pendingLabel="Deleting file"
        title={`Delete ${file.filename} permanently?`}
        variant="destructive"
      />
    </>
  )
}
