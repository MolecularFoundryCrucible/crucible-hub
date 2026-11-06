import { useQuery } from "@tanstack/react-query"

import { useOptionalWorkspaceScope } from "./workspace-provider"
import { SidebarMenuBadge } from "@/components/ui/sidebar"
import {
  identityScope,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import { pendingUsersQueryOptions } from "@/data/crucible/user-approvals.queries"

export function PendingUsersBadge({ enabled }: { enabled: boolean }) {
  const scope = useOptionalWorkspaceScope()
  const query = useQuery({
    ...pendingUsersQueryOptions(
      identityScopeWithPrivilegeMode(
        scope ?? identityScope("anonymous", "anonymous", "normal"),
        "elevated"
      )
    ),
    enabled: enabled && Boolean(scope),
  })
  const count = query.data?.total ?? query.data?.items.length ?? 0
  if (count <= 0) return null
  return (
    <SidebarMenuBadge aria-label={`${count} accounts waiting for approval`}>
      {count}
    </SidebarMenuBadge>
  )
}
