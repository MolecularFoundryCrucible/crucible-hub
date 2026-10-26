import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { createContext, useContext } from "react"

import { AdministratorViewEnabledIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import { notifyError, notifySuccess } from "@/components/crucible/notifications"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { updateGlobalPrivilegeMode } from "@/data/crucible/privilege-mode.functions"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import { useAccountPreferencesEnabled } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { pendingDeletionRequestsCountQueryOptions } from "@/data/crucible/deletion-requests.queries"
import { identityScopeWithPrivilegeMode } from "@/data/crucible/query-keys"
import { recentResourcesQueryOptions } from "@/data/crucible/recent-resources.queries"

function elevatedQueryForAccount(
  queryKey: readonly unknown[],
  scope: IdentityScope
) {
  return (
    queryKey[0] === scope[0] &&
    queryKey[1] === scope[1] &&
    queryKey[2] === scope[2] &&
    queryKey[3] === "elevated"
  )
}

function useAdministratorView({
  privilegeMode,
  scope,
}: {
  privilegeMode: WorkspacePrivilegeMode
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const preferencesEnabled = useAccountPreferencesEnabled()
  const mutation = useMutation({
    mutationFn: async (mode: WorkspacePrivilegeMode) =>
      unwrapHubResult(
        await updateGlobalPrivilegeMode({
          data: {
            mode,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
    onError: (error) => {
      notifyError(
        "Access mode was not changed",
        hubErrorMessage(
          error,
          "Crucible could not change the current access mode."
        )
      )
    },
    onSuccess: async ({ privilegeMode: nextMode }) => {
      // Load what the shell shows for the new mode alongside the route data,
      // so the sidebar and page switch together.
      const nextScope = identityScopeWithPrivilegeMode(scope, nextMode)
      await Promise.all([
        queryClient.prefetchQuery(accountQueryOptions(nextScope)),
        queryClient.prefetchQuery(
          pendingDeletionRequestsCountQueryOptions(nextScope)
        ),
        preferencesEnabled
          ? queryClient.prefetchQuery(recentResourcesQueryOptions(nextScope))
          : undefined,
        router.invalidate({ sync: true }),
      ])
      // Drop elevated data only once the shell has switched to ordinary
      // authority; normal-mode keys never read it, and removing it earlier
      // empties what is still on screen.
      if (nextMode === "normal") {
        await queryClient.cancelQueries({
          predicate: (query) => elevatedQueryForAccount(query.queryKey, scope),
        })
        queryClient.removeQueries({
          predicate: (query) => elevatedQueryForAccount(query.queryKey, scope),
        })
      }
      notifySuccess(
        nextMode === "elevated"
          ? "Administrator view is on"
          : "Administrator view is off",
        nextMode === "elevated"
          ? "Platform-wide resources and actions are now available."
          : "Crucible is using your ordinary access permissions."
      )
    },
  })

  const requested = mutation.isPending ? mutation.variables : undefined
  return {
    active: (requested ?? privilegeMode) === "elevated",
    pending: mutation.isPending,
    setActive(active: boolean) {
      if (mutation.isPending) return
      mutation.mutate(active ? "elevated" : "normal")
    },
  }
}

type AdministratorViewControl = ReturnType<typeof useAdministratorView>

const AdministratorViewContext = createContext<AdministratorViewControl | null>(
  null
)

export function AdministratorViewProvider({
  children,
  privilegeMode,
  scope,
}: {
  children: React.ReactNode
  privilegeMode: WorkspacePrivilegeMode
  scope: IdentityScope
}) {
  const control = useAdministratorView({ privilegeMode, scope })

  return (
    <AdministratorViewContext.Provider value={control}>
      {children}
    </AdministratorViewContext.Provider>
  )
}

export function useAdministratorViewControl() {
  const control = useContext(AdministratorViewContext)
  if (!control) {
    throw new Error(
      "useAdministratorViewControl must be used within AdministratorViewProvider"
    )
  }
  return control
}

export function useOptionalAdministratorViewControl() {
  return useContext(AdministratorViewContext)
}

export function AdministratorViewStatus() {
  const { active, pending, setActive } = useAdministratorViewControl()
  if (!active) return null

  return (
    <Button
      aria-label="Turn off administrator view"
      aria-busy={pending || undefined}
      onClick={() => setActive(false)}
      variant="warning"
    >
      <AdministratorViewEnabledIcon
        aria-hidden="true"
        data-icon="inline-start"
      />
      <span className="hidden md:inline">Administrator view on</span>
    </Button>
  )
}
