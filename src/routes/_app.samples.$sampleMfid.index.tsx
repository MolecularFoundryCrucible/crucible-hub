import { createFileRoute } from "@tanstack/react-router"

import { ResourceOverview } from "@/features/resource-detail/resource-detail-page"

export const Route = createFileRoute("/_app/samples/$sampleMfid/")({
  component: SampleOverviewPage,
})

function SampleOverviewPage() {
  const { sampleMfid } = Route.useParams()
  return <ResourceOverview resourceKind="sample" resourceMfid={sampleMfid} />
}
