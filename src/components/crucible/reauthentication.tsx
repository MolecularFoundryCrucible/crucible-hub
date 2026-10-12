import { Button } from "@/components/ui/button"
import { HubApiClientError, hubErrorMessage } from "@/data/crucible/result"

export function reauthenticationRequired(error: unknown) {
  return (
    error instanceof HubApiClientError &&
    error.details.kind === "reauthentication-required"
  )
}

function reauthenticationHref() {
  const returnTo =
    typeof window === "undefined"
      ? "/hub/"
      : `${window.location.pathname}${window.location.search}`
  return `/hub/auth/login?${new URLSearchParams({ max_age: "0", returnTo })}`
}

export function hubActionError(
  error: unknown,
  fallback: string
): React.ReactNode {
  if (!reauthenticationRequired(error)) return hubErrorMessage(error, fallback)
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span>Confirm it's you by signing in again, then retry.</span>
      <Button
        nativeButton={false}
        render={<a href={reauthenticationHref()} />}
        size="sm"
        variant="link"
      >
        Sign in again
      </Button>
    </span>
  )
}
