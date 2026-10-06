import type { WorkspaceAccount } from "./workspace-source"

export function canOpenPlatformAdministration(account: WorkspaceAccount) {
  return (
    !account.is_service_account &&
    (account.authorization.can_elevate ||
      account.authorization.platform_role === "admin")
  )
}

export function canOpenServiceAccountAdministration(account: WorkspaceAccount) {
  return (
    !account.is_service_account &&
    (account.authorization.can_elevate ||
      account.capabilities.can_manage_service_accounts)
  )
}

export function canOpenUserAdministration(account: WorkspaceAccount) {
  return canOpenPlatformAdministration(account)
}
