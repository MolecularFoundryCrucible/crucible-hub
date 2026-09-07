import { useSuspenseQuery } from "@tanstack/react-query"
import { Navigate, createFileRoute } from "@tanstack/react-router"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { InstrumentRegistrationForm } from "@/features/instrument-registration/instrument-registration-form"

export const Route = createFileRoute("/_app/instruments/new")({
  head: () => ({ meta: [{ title: "Register instrument | Crucible Hub" }] }),
  component: NewInstrumentPage,
})

function NewInstrumentPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  if (account.is_service_account) {
    return <Navigate replace search={{ offset: undefined }} to="/instruments" />
  }
  return <InstrumentRegistrationForm scope={scope} />
}
