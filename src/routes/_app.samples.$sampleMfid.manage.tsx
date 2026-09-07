import { createFileRoute } from "@tanstack/react-router"

import { ResourceManagePage } from "@/features/resource-access/resource-manage-page"

export const Route = createFileRoute("/_app/samples/$sampleMfid/manage")({
  component: SampleManagePage,
})

function SampleManagePage() {
  const { sampleMfid } = Route.useParams()
  return <ResourceManagePage resourceKind="sample" resourceMfid={sampleMfid} />
}
