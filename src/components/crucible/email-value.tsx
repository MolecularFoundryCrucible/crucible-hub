import { Badge } from "@/components/ui/badge"

export function EmailValue({ email }: { email: string }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="min-w-0 wrap-anywhere">{email}</span>
      <Badge variant="outline">Not verified</Badge>
    </span>
  )
}
