import { useQuery } from "@tanstack/react-query"

import { ApiCredentialCard } from "@/components/crucible/api-credential-card"
import { accountCredentialStatusQueryOptions } from "@/data/crucible/account.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage } from "@/data/crucible/result"

export function AccountCredentialCard({ scope }: { scope: IdentityScope }) {
  const query = useQuery(accountCredentialStatusQueryOptions(scope))

  return (
    <ApiCredentialCard
      error={
        query.isError
          ? hubErrorMessage(
              query.error,
              "The API credential status could not be loaded."
            )
          : undefined
      }
      loading={query.isPending}
      onRetry={query.isError ? () => void query.refetch() : undefined}
      status={query.data}
    />
  )
}
