export function EmailValue({ email }: { email: string }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="min-w-0 break-words">{email}</span>
      <span className="text-muted-foreground">Not verified</span>
    </span>
  )
}
