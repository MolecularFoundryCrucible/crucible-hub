import { createFileRoute } from "@tanstack/react-router"

import { ResourceGraphPage } from "@/features/resource-graph/resource-graph-page"

export const Route = createFileRoute("/_app/datasets/$datasetMfid/graph")({
  component: DatasetGraphPage,
})

function DatasetGraphPage() {
  const { datasetMfid } = Route.useParams()
  return <ResourceGraphPage resourceKind="dataset" resourceMfid={datasetMfid} />
}
