import { createFileRoute } from "@tanstack/react-router"

import { ResourceAccessPage } from "@/features/resource-access/resource-access-page"

export const Route = createFileRoute("/_app/datasets/$datasetMfid/access")({
  component: DatasetAccessPage,
})

function DatasetAccessPage() {
  const { datasetMfid } = Route.useParams()
  return (
    <ResourceAccessPage resourceKind="dataset" resourceMfid={datasetMfid} />
  )
}
