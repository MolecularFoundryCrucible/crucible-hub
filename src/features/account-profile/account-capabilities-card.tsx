import {
  CapabilityAvailableIcon,
  CapabilityUnavailableIcon,
} from "@/components/crucible/icons"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import { cn } from "@/lib/utils"

const capabilityDefinitions = [
  ["can_create_project", "Create projects"],
  ["can_create_sample", "Create samples"],
  ["can_create_dataset", "Create datasets"],
  ["can_register_instrument", "Register instruments"],
  ["can_create_for_others", "Create resources for others"],
  ["can_manage_service_accounts", "Manage service accounts"],
] as const satisfies readonly [keyof WorkspaceAccount["capabilities"], string][]

export function AccountCapabilitiesCard({
  account,
}: {
  account: WorkspaceAccount
}) {
  const { platform_role } = account.authorization
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account access</CardTitle>
        <CardAction>
          <PlatformRoleBadge role={platform_role} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="grid gap-3 @fields-wide:grid-cols-2">
          {capabilityDefinitions.map(([capability, label]) => {
            const available = account.capabilities[capability]
            return (
              <li
                className={cn(
                  "flex min-w-0 items-center gap-2 text-body",
                  !available && "text-muted-foreground"
                )}
                key={capability}
              >
                <span
                  aria-label={available ? "Available" : "Not available"}
                  className="inline-flex shrink-0"
                  role="img"
                >
                  {available ? (
                    <CapabilityAvailableIcon
                      aria-hidden="true"
                      className="size-4 text-success"
                    />
                  ) : (
                    <CapabilityUnavailableIcon
                      aria-hidden="true"
                      className="size-4"
                    />
                  )}
                </span>
                <span className="break-words">{label}</span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
