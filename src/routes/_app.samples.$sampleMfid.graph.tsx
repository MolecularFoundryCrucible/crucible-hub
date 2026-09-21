import { useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { ResourceGraphPage } from "@/features/resource-graph/resource-graph-page"
import {
  resolveResourceGraphDisplay,
  resourceGraphDisplaySearchPatch,
  resourceGraphDisplaySearchSchema,
} from "@/features/resource-graph/resource-graph-display"
import type { ResourceGraphDisplay } from "@/features/resource-graph/resource-graph-display"

export const Route = createFileRoute("/_app/samples/$sampleMfid/graph")({
  validateSearch: resourceGraphDisplaySearchSchema,
  component: SampleGraphPage,
})

function SampleGraphPage() {
  const { sampleMfid } = Route.useParams()
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
      resourceKind="sample"
      resourceMfid={sampleMfid}
    />
  )
}
