import { createFileRoute } from "@tanstack/react-router"

import { DatasetProcessingPage } from "@/features/dataset-processing/dataset-processing-page"

export const Route = createFileRoute("/_app/datasets/$datasetMfid/processing")({
  component: DatasetProcessingRoute,
})

function DatasetProcessingRoute() {
  const { datasetMfid } = Route.useParams()
  return <DatasetProcessingPage datasetMfid={datasetMfid} />
}
