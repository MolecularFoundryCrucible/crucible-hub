import {
  CreatedFieldIcon,
  MfidFieldIcon,
  UpdatedFieldIcon,
} from "@/components/crucible/icons"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { cn } from "@/lib/utils"

export type IdentityFieldType = "created" | "mfid" | "owner" | "updated"

const identityIcons = {
  created: CreatedFieldIcon,
  mfid: MfidFieldIcon,
  updated: UpdatedFieldIcon,
} as const

export function IdentityFieldIcon({
  accountType = "person",
  className,
  type,
}: {
  accountType?: "person" | "service-account"
  className?: string
  type: IdentityFieldType
}) {
  if (type === "owner") {
    return (
      <PrincipalTypeIcon
        className={cn("mt-0.5 size-4 shrink-0", className)}
        type={accountType === "service-account" ? "service_account" : "user"}
      />
    )
  }
  const Icon = identityIcons[type]
  return (
    <Icon
      aria-hidden="true"
      className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground", className)}
      data-identity-field-icon={type}
    />
  )
}
