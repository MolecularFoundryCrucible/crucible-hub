import {
  DatasetIcon,
  InstrumentIcon,
  PersonIcon,
  ProjectIcon,
  SampleIcon,
  ServiceAccountIcon,
} from "@/components/crucible/icons"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"

const capabilityDefinitions = [
  ["can_create_project", "Create projects", ProjectIcon],
  ["can_create_sample", "Create samples", SampleIcon],
  ["can_create_dataset", "Create datasets", DatasetIcon],
  ["can_register_instrument", "Register instruments", InstrumentIcon],
  ["can_create_for_others", "Create resources for others", PersonIcon],
  [
    "can_manage_service_accounts",
    "Manage service accounts",
    ServiceAccountIcon,
  ],
] as const satisfies readonly [
  keyof WorkspaceAccount["capabilities"],
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>,
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
        <ul className="divide-y">
          {capabilityDefinitions.map(([capability, label, Icon]) => {
            const available = account.capabilities[capability]
            return (
              <li
                className="flex min-w-0 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                key={capability}
              >
                <span className="flex min-w-0 items-center gap-2 text-body">
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="break-words">{label}</span>
                </span>
                <Badge variant={available ? "secondary" : "outline"}>
                  {available ? "Available" : "Not available"}
                </Badge>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
