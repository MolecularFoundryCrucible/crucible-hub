import { createFileRoute } from "@tanstack/react-router"

import {
  ResourceGraphPage,
  resourceGraphSearchSchema,
} from "@/features/resource-graph/resource-graph-page"

export const Route = createFileRoute("/_app/datasets/$datasetMfid/graph")({
  validateSearch: resourceGraphSearchSchema,
  component: DatasetGraphPage,
})

function DatasetGraphPage() {
  const { datasetMfid } = Route.useParams()
  const { depth = 1 } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ResourceGraphPage
      depth={depth}
      onDepthChange={(nextDepth) => {
        void navigate({
          replace: true,
          search: (previous) => ({
            ...previous,
            depth: nextDepth === 1 ? undefined : nextDepth,
          }),
        })
      }}
      resourceKind="dataset"
      resourceMfid={datasetMfid}
    />
  )
}
