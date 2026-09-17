import {
  PrincipalTypeIcon,
  ResourceTypeIcon,
} from "@/components/crucible/resource-type-icon"
import {
  CapabilityAvailableIcon,
  CapabilityUnavailableIcon,
} from "@/components/crucible/icons"
import type {
  PrincipalType,
  ResourceType,
} from "@/components/crucible/resource-type-icon"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"

const capabilityDefinitions = [
  ["can_create_project", "Create projects", "resource", "project"],
  ["can_create_sample", "Create samples", "resource", "sample"],
  ["can_create_dataset", "Create datasets", "resource", "dataset"],
  ["can_register_instrument", "Register instruments", "resource", "instrument"],
  ["can_create_for_others", "Create resources for others", "principal", "user"],
  [
    "can_manage_service_accounts",
    "Manage service accounts",
    "principal",
    "service_account",
  ],
] as const satisfies readonly [
  keyof WorkspaceAccount["capabilities"],
  string,
  "principal" | "resource",
  PrincipalType | ResourceType,
][]

export function AccountCapabilitiesCard({
  account,
}: {
  account: WorkspaceAccount
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account access</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-4 md:grid-cols-2">
          {capabilityDefinitions.map(([capability, label, kind, type]) => {
            const available = account.capabilities[capability]
            return (
              <li
                className="flex min-w-0 items-center justify-between gap-3"
                key={capability}
              >
                <span className="flex min-w-0 items-center gap-2 text-body">
                  {kind === "resource" ? (
                    <ResourceTypeIcon className="size-4 shrink-0" type={type} />
                  ) : (
                    <PrincipalTypeIcon type={type} />
                  )}
                  <span className="break-words">{label}</span>
                </span>
                <span
                  aria-label={available ? "Available" : "Not available"}
                  className="inline-flex shrink-0"
                  role="img"
                >
                  {available ? (
                    <CapabilityAvailableIcon
                      aria-hidden="true"
                      className="size-5 text-success"
                    />
                  ) : (
                    <CapabilityUnavailableIcon
                      aria-hidden="true"
                      className="size-5 text-destructive"
                    />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
