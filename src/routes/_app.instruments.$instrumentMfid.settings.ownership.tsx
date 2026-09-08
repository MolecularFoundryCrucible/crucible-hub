import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/settings/ownership"
)({
  component: InstrumentOwnershipRedirect,
})

function InstrumentOwnershipRedirect() {
  const { instrumentMfid } = Route.useParams()
  return (
    <Navigate
      params={{ instrumentMfid }}
      replace
      to="/instruments/$instrumentMfid/settings"
    />
  )
}
