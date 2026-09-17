import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  AddThumbnailIcon,
  EditResourceIcon,
  RemoveThumbnailIcon,
  SaveChangesIcon,
} from "@/components/crucible/icons"
import { PanelState } from "@/components/crucible/collection-state"
import { DatasetThumbnailImage } from "@/components/crucible/dataset-thumbnail"
import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  mutateWorkspaceDatasetThumbnail,
  THUMBNAIL_NAME_MAX_LENGTH,
  THUMBNAIL_SOURCE_MAX_BYTES,
} from "@/data/crucible/resources.functions"
import {
  datasetThumbnailsQueryOptions,
  resourceQueryOptions,
} from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceDatasetThumbnail,
  WorkspaceDatasetThumbnailOperation,
} from "@/data/crucible/workspace-source"
import { formatBytes } from "@/lib/format"

const acceptedThumbnailTypes =
  "image/jpeg,image/png,image/webp,image/tiff,image/bmp,image/gif,.tif,.tiff"

export function DatasetThumbnailsCard({
  canEdit,
  datasetMfid,
  mode,
  scope,
}: {
  canEdit: boolean
  datasetMfid: string
  mode: "api" | "fixture"
  scope: IdentityScope
}) {
  const [hydrated, setHydrated] = useState(false)
  const [editing, setEditing] = useState(false)
  const query = useQuery({
    ...datasetThumbnailsQueryOptions(scope, datasetMfid),
    enabled: hydrated,
  })

  useEffect(() => setHydrated(true), [])

  return (
    <Card aria-busy={query.isFetching}>
      <CardHeader actionLayout="inline">
        <CardTitle>Thumbnails</CardTitle>
        {canEdit && query.data ? (
          <CardAction>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={
                      editing ? "Finish editing thumbnails" : "Edit thumbnails"
                    }
                    onClick={() => setEditing((current) => !current)}
                    size="icon-sm"
                    variant="outline"
                  />
                }
              >
                <EditResourceIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>
                {editing ? "Finish editing thumbnails" : "Edit thumbnails"}
              </TooltipContent>
            </Tooltip>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {!hydrated || query.isPending ? (
          <ThumbnailSkeleton />
        ) : !query.data ? (
          <PanelState
            retry={() => void query.refetch()}
            role="alert"
            title="Thumbnails could not be loaded"
          />
        ) : editing ? (
          <ThumbnailEditor
            datasetMfid={datasetMfid}
            mode={mode}
            scope={scope}
            thumbnails={query.data}
          />
        ) : query.data.length === 0 ? (
          <PanelState title="No thumbnail images have been added" />
        ) : (
          <ThumbnailGallery thumbnails={query.data} />
        )}
      </CardContent>
    </Card>
  )
}

export function ThumbnailGallery({
  thumbnails,
}: {
  thumbnails: readonly WorkspaceDatasetThumbnail[]
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {thumbnails.map((thumbnail) => (
        <li key={thumbnail.id}>
          <figure className="overflow-hidden rounded-lg border bg-muted/20">
            <DatasetThumbnailImage
              alt=""
              className="aspect-video w-full bg-card object-contain"
              loading="lazy"
              thumbnail={thumbnail}
            />
            <figcaption className="truncate border-t px-3 py-2 text-label">
              {thumbnail.thumbnail_name}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  )
}

function ThumbnailEditor({
  datasetMfid,
  mode,
  scope,
  thumbnails,
}: {
  datasetMfid: string
  mode: "api" | "fixture"
  scope: IdentityScope
  thumbnails: readonly WorkspaceDatasetThumbnail[]
}) {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File>()
  const [name, setName] = useState("")
  const [draftNames, setDraftNames] = useState<Record<number, string>>({})
  const [deleting, setDeleting] = useState<WorkspaceDatasetThumbnail>()
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (operation: WorkspaceDatasetThumbnailOperation) =>
      unwrapHubResult(
        await mutateWorkspaceDatasetThumbnail({ data: operation })
      ),
    onSuccess: (confirmed) => {
      queryClient.setQueryData(
        crucibleKeys.datasetThumbnails(scope, datasetMfid),
        confirmed
      )
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.datasetThumbnailPreviewLists(scope),
      })
      if (mode === "api") {
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: resourceQueryOptions(scope, datasetMfid).queryKey,
        })
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.datasetLists(scope),
        })
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.searches(scope),
        })
      }
    },
  })
  const scenario = fixtureScenarioFromScope(scope)

  async function addThumbnail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)
    const thumbnailName = name.trim()
    if (!file || !thumbnailName) {
      setError("Choose an image and provide a name.")
      return
    }
    if (file.size > THUMBNAIL_SOURCE_MAX_BYTES) {
      setError(
        `Choose an image no larger than ${formatBytes(THUMBNAIL_SOURCE_MAX_BYTES)}.`
      )
      return
    }
    try {
      const thumbnail_b64str = await fileBase64(file)
      await mutation.mutateAsync({
        action: "add",
        datasetMfid,
        scenario,
        thumbnail_b64str,
        thumbnail_name: thumbnailName,
      })
      setFile(undefined)
      setName("")
      if (fileInput.current) fileInput.current.value = ""
    } catch (caught) {
      setError(thumbnailErrorMessage(caught))
    }
  }

  async function renameThumbnail(thumbnail: WorkspaceDatasetThumbnail) {
    setError(undefined)
    const thumbnailName = (
      draftNames[thumbnail.id] ?? thumbnail.thumbnail_name
    ).trim()
    if (!thumbnailName) {
      setError("Thumbnail names cannot be empty.")
      return
    }
    try {
      await mutation.mutateAsync({
        action: "rename",
        datasetMfid,
        scenario,
        thumbnailId: thumbnail.id,
        thumbnail_name: thumbnailName,
      })
      setDraftNames((current) => {
        const next = { ...current }
        delete next[thumbnail.id]
        return next
      })
    } catch (caught) {
      setError(thumbnailErrorMessage(caught))
    }
  }

  async function deleteThumbnail() {
    if (!deleting) return
    setError(undefined)
    try {
      await mutation.mutateAsync({
        action: "delete",
        datasetMfid,
        scenario,
        thumbnailId: deleting.id,
      })
      setDeleting(undefined)
    } catch (caught) {
      setError(thumbnailErrorMessage(caught))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={addThumbnail}>
        <Field>
          <FieldLabel htmlFor={`thumbnail-file-${datasetMfid}`}>
            Image
          </FieldLabel>
          <Input
            accept={acceptedThumbnailTypes}
            disabled={mutation.isPending}
            id={`thumbnail-file-${datasetMfid}`}
            onChange={(event) => {
              const nextFile = event.target.files?.[0]
              setFile(nextFile)
              if (nextFile && !name) setName(nextFile.name)
            }}
            ref={fileInput}
            required
            type="file"
          />
          <FieldDescription>
            JPEG, PNG, WebP, TIFF, BMP, or GIF up to 50 MiB.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`thumbnail-name-${datasetMfid}`}>
            Thumbnail name
          </FieldLabel>
          <Input
            disabled={mutation.isPending}
            id={`thumbnail-name-${datasetMfid}`}
            maxLength={THUMBNAIL_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button disabled={mutation.isPending} type="submit">
            <AddThumbnailIcon aria-hidden="true" data-icon="inline-start" />
            Add thumbnail
          </Button>
        </div>
      </form>

      {thumbnails.length === 0 ? (
        <p className="text-body text-muted-foreground">
          No thumbnail images have been added.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {thumbnails.map((thumbnail) => {
            const draftName =
              draftNames[thumbnail.id] ?? thumbnail.thumbnail_name
            return (
              <li
                className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3"
                key={thumbnail.id}
              >
                <DatasetThumbnailImage
                  alt=""
                  className="aspect-video w-full rounded-md bg-card object-contain"
                  thumbnail={thumbnail}
                />
                <Field>
                  <FieldLabel htmlFor={`thumbnail-${thumbnail.id}-name`}>
                    Name
                  </FieldLabel>
                  <Input
                    disabled={mutation.isPending}
                    id={`thumbnail-${thumbnail.id}-name`}
                    maxLength={THUMBNAIL_NAME_MAX_LENGTH}
                    onChange={(event) =>
                      setDraftNames((current) => ({
                        ...current,
                        [thumbnail.id]: event.target.value,
                      }))
                    }
                    value={draftName}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      mutation.isPending ||
                      draftName.trim() === thumbnail.thumbnail_name
                    }
                    onClick={() => void renameThumbnail(thumbnail)}
                    size="sm"
                    type="button"
                  >
                    <SaveChangesIcon
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    Save name
                  </Button>
                  <Button
                    disabled={mutation.isPending}
                    onClick={() => setDeleting(thumbnail)}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    <RemoveThumbnailIcon
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    Delete
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {error ? (
        <p className="text-body text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ConfirmationAlertDialog
        confirmLabel="Delete thumbnail"
        description={
          <>
            This permanently removes{" "}
            {deleting?.thumbnail_name ?? "the thumbnail"} from the dataset.
          </>
        }
        onOpenChange={(open) => !open && setDeleting(undefined)}
        onConfirm={() => void deleteThumbnail()}
        open={Boolean(deleting)}
        pending={mutation.isPending}
        title="Delete thumbnail?"
        variant="destructive"
      />
    </div>
  )
}

function ThumbnailSkeleton() {
  return (
    <div
      aria-label="Loading thumbnails"
      className="grid gap-4 sm:grid-cols-2"
      role="status"
    >
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="aspect-video w-full" />
    </div>
  )
}

async function fileBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("The image could not be read."))
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The image could not be read."))
    reader.readAsDataURL(file)
  })
  const separator = dataUrl.indexOf(",")
  if (separator < 0) throw new Error("The image could not be read.")
  return dataUrl.slice(separator + 1)
}

function thumbnailErrorMessage(error: unknown) {
  if (error instanceof HubApiClientError) {
    if (error.details.kind === "validation") {
      return "The API could not use that image or thumbnail name."
    }
    if (error.details.kind === "not-found") {
      return "The dataset or thumbnail is no longer available."
    }
    return `The thumbnail change could not be saved. Reference: ${error.details.correlationId}`
  }
  return error instanceof Error
    ? error.message
    : "The thumbnail change could not be saved."
}
