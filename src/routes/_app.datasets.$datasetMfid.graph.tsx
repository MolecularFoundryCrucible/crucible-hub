import { useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { ResourceGraphPage } from "@/features/resource-graph/resource-graph-page"
import {
  resolveResourceGraphDisplay,
  resourceGraphDisplaySearchPatch,
  resourceGraphDisplaySearchSchema,
} from "@/features/resource-graph/resource-graph-display"
import type { ResourceGraphDisplay } from "@/features/resource-graph/resource-graph-display"

export const Route = createFileRoute("/_app/datasets/$datasetMfid/graph")({
  validateSearch: resourceGraphDisplaySearchSchema,
  component: DatasetGraphPage,
})

function DatasetGraphPage() {
  const { datasetMfid } = Route.useParams()
  const display = resolveResourceGraphDisplay(Route.useSearch())
  const navigate = Route.useNavigate()
  const updateDisplay = useCallback(
    (changes: Partial<ResourceGraphDisplay>) => {
      void navigate({
        replace: true,
        resetScroll: false,
        search: (current) => ({
          ...current,
          ...resourceGraphDisplaySearchPatch(changes),
        }),
      })
    },
    [navigate]
  )
  return (
    <ResourceGraphPage
      display={display}
      onDisplayChange={updateDisplay}
      resourceKind="dataset"
      resourceMfid={datasetMfid}
    />
  )
}
