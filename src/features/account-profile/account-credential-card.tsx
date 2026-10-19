import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"

import {
  ApiCredentialCard,
  RotateCredentialAction,
} from "@/components/crucible/api-credential-card"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { hubActionError } from "@/components/crucible/reauthentication"
import { regenerateAccountApiKey } from "@/data/crucible/account.functions"
import {
  accountCredentialStatusQueryOptions,
  accountQueryOptions,
} from "@/data/crucible/account.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import { OneTimeCredentialDialog } from "@/features/service-accounts/one-time-credential-dialog"

const workspaceRoute = getRouteApi("/_app")

export function AccountCredentialCard({ scope }: { scope: IdentityScope }) {
  const query = useQuery(accountCredentialStatusQueryOptions(scope))
  const account = useQuery(accountQueryOptions(scope)).data
  const workspace = workspaceRoute.useLoaderData()
  const canRegenerate =
    workspace.status === "ready" &&
    (workspace.mode === "fixture" || workspace.sessionAuth)

  return (
    <ApiCredentialCard
      action={canRegenerate ? <RegenerateKeyAction scope={scope} /> : undefined}
      error={
        query.isError
          ? hubErrorMessage(
              query.error,
              "The API key status could not be loaded."
            )
          : undefined
      }
      lastActiveAt={account?.last_active_at}
      loading={query.isPending}
      onRetry={query.isError ? () => void query.refetch() : undefined}
      status={query.data}
    />
  )
}

function RegenerateKeyAction({ scope }: { scope: IdentityScope }) {
  const queryClient = useQueryClient()
  const account = useQuery(accountQueryOptions(scope)).data
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<React.ReactNode>()
  const [apiKey, setApiKey] = useState<string>()
  const mutation = useMutation({
    mutationFn: async () => unwrapHubResult(await regenerateAccountApiKey()),
    onError: (cause) =>
      setError(hubActionError(cause, "A new API key could not be issued.")),
    onSuccess: (result) => {
      setConfirming(false)
      setError(undefined)
      setApiKey(result.api_key)
      void queryClient.invalidateQueries({
        queryKey: accountCredentialStatusQueryOptions(scope).queryKey,
      })
    },
  })

  return (
    <>
      <RotateCredentialAction
        label="Regenerate key"
        onClick={() => setConfirming(true)}
      />
      <ConfirmationDialog
        confirmLabel="Regenerate key"
        description="Your current key stops working immediately. Scripts and tools that use it, such as nano-crucible, will need the new key."
        error={error}
        kind="alert"
        onConfirm={() => mutation.mutate()}
        onOpenChange={(open) => {
          setConfirming(open)
          if (!open) setError(undefined)
        }}
        open={confirming}
        pending={mutation.isPending}
        pendingLabel="Regenerating key"
        title="Regenerate your API key?"
        variant="destructive"
      />
      <OneTimeCredentialDialog
        credential={
          apiKey && account
            ? {
                api_key: apiKey,
                unique_id: account.unique_id,
                username: account.username ?? null,
              }
            : undefined
        }
        keyLabel="Your API key"
        onClose={() => setApiKey(undefined)}
        title="New API key"
      />
    </>
  )
}
