import { createFileRoute } from "@tanstack/react-router"

import { ResourceManagePage } from "@/features/resource-access/resource-manage-page"

export const Route = createFileRoute("/_app/datasets/$datasetMfid/manage")({
  component: DatasetManagePage,
})

function DatasetManagePage() {
  const { datasetMfid } = Route.useParams()
  return (
    <ResourceManagePage resourceKind="dataset" resourceMfid={datasetMfid} />
  )
}
