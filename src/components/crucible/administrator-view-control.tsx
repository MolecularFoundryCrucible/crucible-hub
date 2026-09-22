import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { createContext, useContext } from "react"

import { AdministratorViewEnabledIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { updateGlobalPrivilegeMode } from "@/data/crucible/privilege-mode.functions"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"

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
      toast.add({
        description: hubErrorMessage(
          error,
          "Crucible could not change the current access mode."
        ),
        title: "Access mode was not changed",
        type: "error",
      })
    },
    onSuccess: async ({ privilegeMode: nextMode }) => {
      if (nextMode === "normal") {
        await queryClient.cancelQueries({
          predicate: (query) => elevatedQueryForAccount(query.queryKey, scope),
        })
        queryClient.removeQueries({
          predicate: (query) => elevatedQueryForAccount(query.queryKey, scope),
        })
      }
      await router.invalidate({ sync: true })
      toast.add({
        description:
          nextMode === "elevated"
            ? "Platform-wide resources and actions are now available."
            : "Crucible is using your ordinary access permissions.",
        title:
          nextMode === "elevated"
            ? "Administrator view is on"
            : "Administrator view is off",
        type: "success",
      })
    },
  })

  return {
    active: privilegeMode === "elevated",
    pending: mutation.isPending,
    setActive(active: boolean) {
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

export function AdministratorViewStatus() {
  const { pending, setActive } = useAdministratorViewControl()

  return (
    <Button
      aria-label="Turn off administrator view"
      disabled={pending}
      onClick={() => setActive(false)}
      size="sm"
      variant="warning"
    >
      <AdministratorViewEnabledIcon data-icon="inline-start" />
      <span className="hidden sm:inline">Administrator view on</span>
    </Button>
  )
}
