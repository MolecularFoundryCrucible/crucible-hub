import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"

import { AdministratorViewIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
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

export function useAdministratorView({
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

export function AdministratorViewMenuItem({
  active,
  pending,
  setActive,
}: ReturnType<typeof useAdministratorView>) {
  return (
    <DropdownMenuCheckboxItem
      checked={active}
      disabled={pending}
      onCheckedChange={setActive}
    >
      <AdministratorViewIcon />
      Administrator view
    </DropdownMenuCheckboxItem>
  )
}

export function AdministratorViewStatus({
  pending,
  setActive,
}: ReturnType<typeof useAdministratorView>) {
  return (
    <Button
      aria-label="Turn off administrator view"
      disabled={pending}
      onClick={() => setActive(false)}
      size="sm"
      variant="warning"
    >
      <AdministratorViewIcon data-icon="inline-start" />
      <span className="hidden sm:inline">Administrator view on</span>
    </Button>
  )
}
