import type { WorkspaceAccount } from "./workspace-source"

export function accountNeedsSetup(
  account: Pick<WorkspaceAccount, "email" | "username">
) {
  return !account.email?.trim() || !account.username?.trim()
}

export function accountSetupDestination(value?: string) {
  if (!value || value.length > 1024 || !value.startsWith("/hub/")) {
    return "/hub/"
  }

  try {
    const destination = new URL(value, "https://hub.invalid")
    if (
      destination.origin !== "https://hub.invalid" ||
      destination.pathname.startsWith("/hub/auth/") ||
      destination.pathname === "/hub/account/setup"
    ) {
      return "/hub/"
    }
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return "/hub/"
  }
}
