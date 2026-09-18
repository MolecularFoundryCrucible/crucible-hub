import { createFileRoute } from "@tanstack/react-router"

import { ResourceGraphPage } from "@/features/resource-graph/resource-graph-page"

export const Route = createFileRoute("/_app/samples/$sampleMfid/graph")({
  component: SampleGraphPage,
})

function SampleGraphPage() {
  const { sampleMfid } = Route.useParams()
  return <ResourceGraphPage resourceKind="sample" resourceMfid={sampleMfid} />
}
