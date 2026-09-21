import {
  PrivateAccessIcon,
  PublicAccessIcon,
} from "@/components/crucible/icons"
import { Badge } from "@/components/ui/badge"

export function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  const Icon = isPublic ? PublicAccessIcon : PrivateAccessIcon

  return (
    <Badge variant={isPublic ? "secondary" : "outline"}>
      <Icon aria-hidden="true" data-icon="inline-start" />
      {isPublic ? "Public" : "Private"}
    </Badge>
  )
}
