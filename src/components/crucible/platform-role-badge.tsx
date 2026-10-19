import { AccessRoleBadge } from "@/components/crucible/access-role-badge"
import { Badge } from "@/components/ui/badge"
import type { components } from "@/generated/crucible-api"

type PlatformRole = components["schemas"]["PlatformRole"]

export function PlatformRoleBadge({ role }: { role: PlatformRole }) {
  if (role === "admin" || role === "contributor") {
    return <AccessRoleBadge role={role} />
  }
  return (
    <Badge variant={role === "support" ? "secondary" : "outline"}>
      {role === "support" ? "Support" : "None"}
    </Badge>
  )
}
