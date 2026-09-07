import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/datasets/$datasetMfid/access")({
  component: LegacyDatasetAccessPage,
})

function LegacyDatasetAccessPage() {
  const { datasetMfid } = Route.useParams()
  return (
    <Navigate
      params={{ datasetMfid }}
      replace
      search={true}
      to="/datasets/$datasetMfid/manage"
    />
  )
}
