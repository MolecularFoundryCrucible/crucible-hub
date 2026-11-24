import {
  PendingName,
  PanelState,
  PanelUpdateError,
} from "@/components/crucible/collection-state"
import { useEffect, useId, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  COLLAPSED_LIST_LIMIT,
  ListExpansionToggle,
  revealedRowClassName,
} from "@/components/crucible/list-expansion-toggle"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import {
  ResourceList,
  ResourceListItem,
  ResourceListItemContent,
} from "@/components/crucible/resource-list"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { datasetFilesQueryOptions } from "@/data/crucible/resources.queries"
import { FileDownloadAction } from "@/features/dataset-files/dataset-files-card"
import { formatBytes } from "@/lib/format"

const fileNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

export function InspectorDatasetFiles({
  datasetMfid,
}: {
  datasetMfid: string
}) {
  const scope = useWorkspaceScope()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const filesResult = useQuery(datasetFilesQueryOptions(scope, datasetMfid))
  const files = filesResult.data
  const identity = JSON.stringify(scope)
  const scenario = fixtureScenarioFromScope(scope)

  useEffect(() => setExpanded(false), [datasetMfid])

  const sortedFiles = useMemo(
    () =>
      files
        ? [...files].sort((left, right) =>
            fileNameCollator.compare(left.filename, right.filename)
          )
        : undefined,
    [files]
  )
  const visibleFiles = expanded
    ? sortedFiles
    : sortedFiles?.slice(0, COLLAPSED_LIST_LIMIT)

  return (
    <section
      aria-labelledby="inspector-files-heading"
      className="border-t pt-4"
    >
      <h3 className="mb-3 text-title-section" id="inspector-files-heading">
        Files{files?.length ? ` (${files.length})` : ""}
      </h3>
      {filesResult.isPending ? (
        <InspectorFileRowsPending />
      ) : sortedFiles !== undefined && visibleFiles !== undefined ? (
        <div aria-busy={filesResult.isFetching} className="grid gap-3">
          {filesResult.isError ? (
            <PanelUpdateError
              description="Files could not be refreshed. Showing the last available data."
              retry={() => void filesResult.refetch()}
            />
          ) : null}
          {sortedFiles.length ? (
            <div>
              <ResourceList id={listId}>
                {visibleFiles.map((file, index) => (
                  <ResourceListItem
                    className={revealedRowClassName(index)}
                    key={file.mfid}
                  >
                    <ResourceListItemContent className="px-0">
                      <ResourceIdentity
                        className="min-w-0 flex-1"
                        context={`${file.storage_backend} · ${formatBytes(file.size)}`}
                        kind="file"
                        name={file.filename}
                        presentation="collection"
                      />
                      <FileDownloadAction
                        file={file}
                        identity={identity}
                        scenario={scenario}
                      />
                    </ResourceListItemContent>
                  </ResourceListItem>
                ))}
              </ResourceList>
              {sortedFiles.length > COLLAPSED_LIST_LIMIT ? (
                <div className="mt-1 -ml-1.5 flex">
                  <ListExpansionToggle
                    controls={listId}
                    expanded={expanded}
                    noun="files"
                    onExpandedChange={setExpanded}
                    total={sortedFiles.length}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-body text-muted-foreground">No files</p>
          )}
        </div>
      ) : (
        <PanelState
          retry={() => void filesResult.refetch()}
          role="alert"
          title="Files could not be loaded"
        />
      )}
    </section>
  )
}

export function InspectorFilesPending() {
  return (
    <section className="border-t pt-4">
      <h3 className="mb-3 text-title-section">Files</h3>
      <InspectorFileRowsPending />
    </section>
  )
}

function InspectorFileRowsPending() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 2 }, (_, index) => (
        <div className="flex items-center gap-2" key={index}>
          <div className="min-w-0 flex-1">
            <PendingName />
          </div>
          <Skeleton className="size-8 shrink-0" />
        </div>
      ))}
    </div>
  )
}
