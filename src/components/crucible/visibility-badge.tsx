import { Badge } from "@/components/ui/badge"

export function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return (
    <Badge variant={isPublic ? "secondary" : "outline"}>
      {isPublic ? "Public" : "Private"}
    </Badge>
  )
}
