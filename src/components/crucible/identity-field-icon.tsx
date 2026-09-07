import {
  CreatedFieldIcon,
  MfidFieldIcon,
  PrivateAccessIcon,
  PublicAccessIcon,
  UpdatedFieldIcon,
} from "@/components/crucible/icons"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { cn } from "@/lib/utils"

export type IdentityFieldType =
  | "created"
  | "mfid"
  | "owner"
  | "updated"
  | "visibility-private"
  | "visibility-public"

const identityIcons = {
  created: CreatedFieldIcon,
  mfid: MfidFieldIcon,
  updated: UpdatedFieldIcon,
  "visibility-private": PrivateAccessIcon,
  "visibility-public": PublicAccessIcon,
} as const

export function IdentityFieldIcon({
  className,
  type,
}: {
  className?: string
  type: IdentityFieldType
}) {
  if (type === "owner") {
    return (
      <ResourceTypeIcon
        className={cn("mt-0.5 size-4 shrink-0", className)}
        type="person"
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
