import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/samples/$sampleMfid/access")({
  component: LegacySampleAccessPage,
})

function LegacySampleAccessPage() {
  const { sampleMfid } = Route.useParams()
  return (
    <Navigate
      params={{ sampleMfid }}
      replace
      search={true}
      to="/samples/$sampleMfid/manage"
    />
  )
}
