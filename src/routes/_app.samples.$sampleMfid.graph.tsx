import { createFileRoute } from "@tanstack/react-router"

import {
  ResourceGraphPage,
  resourceGraphSearchSchema,
} from "@/features/resource-graph/resource-graph-page"

export const Route = createFileRoute("/_app/samples/$sampleMfid/graph")({
  validateSearch: resourceGraphSearchSchema,
  component: SampleGraphPage,
})

function SampleGraphPage() {
  const { sampleMfid } = Route.useParams()
  const { depth = 3 } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ResourceGraphPage
      depth={depth}
      onDepthChange={(nextDepth) => {
        void navigate({
          replace: true,
          search: (previous) => ({
            ...previous,
            depth: nextDepth === 3 ? undefined : nextDepth,
          }),
        })
      }}
      resourceKind="sample"
      resourceMfid={sampleMfid}
    />
  )
}
