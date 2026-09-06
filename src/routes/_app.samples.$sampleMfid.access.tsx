import { createFileRoute } from "@tanstack/react-router"

import { ResourceAccessPage } from "@/features/resource-access/resource-access-page"

export const Route = createFileRoute("/_app/samples/$sampleMfid/access")({
  component: SampleAccessPage,
})

function SampleAccessPage() {
  const { sampleMfid } = Route.useParams()
  return <ResourceAccessPage resourceKind="sample" resourceMfid={sampleMfid} />
}
