import type { WorkspacePrivilegeMode } from "./privilege-mode"
import type { WorkspaceAccount } from "./workspace-source"

export function canUseAdministratorView(account: WorkspaceAccount) {
  return (
    !account.is_service_account &&
    (account.authorization.can_elevate ||
      account.authorization.platform_role === "admin")
  )
}

export function canOpenPlatformAdministration(
  account: WorkspaceAccount,
  privilegeMode: WorkspacePrivilegeMode
) {
  return privilegeMode === "elevated" && canUseAdministratorView(account)
}

export function canOpenServiceAccountAdministration(
  account: WorkspaceAccount,
  privilegeMode: WorkspacePrivilegeMode
) {
  return canOpenPlatformAdministration(account, privilegeMode)
}

export function canOpenUserAdministration(
  account: WorkspaceAccount,
  privilegeMode: WorkspacePrivilegeMode
) {
  return canOpenPlatformAdministration(account, privilegeMode)
}
