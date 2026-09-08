import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/settings/lifecycle"
)({
  component: InstrumentLifecycleRedirect,
})

function InstrumentLifecycleRedirect() {
  const { instrumentMfid } = Route.useParams()
  return (
    <Navigate
      params={{ instrumentMfid }}
      replace
      to="/instruments/$instrumentMfid/settings"
    />
  )
}
