import { createContext, useContext } from "react"

import {
  identityScopeWithPrivilegeMode,
  privilegeModeFromScope,
} from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import type { WorkspaceMode } from "@/data/crucible/workspace-source"

type WorkspaceContextValue = {
  accountPreferencesEnabled: boolean
  mode: WorkspaceMode
  privilegeMode: WorkspacePrivilegeMode
  scope: IdentityScope
  uploadIngestionEnabled: boolean
  uploadsEnabled: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
)

export function WorkspaceProvider({
  accountPreferencesEnabled = false,
  children,
  mode,
  scope,
  privilegeMode = privilegeModeFromScope(scope),
  uploadIngestionEnabled = false,
  uploadsEnabled = false,
}: {
  accountPreferencesEnabled?: boolean
  children: React.ReactNode
  mode: WorkspaceMode
  privilegeMode?: WorkspacePrivilegeMode
  scope: IdentityScope
  uploadIngestionEnabled?: boolean
  uploadsEnabled?: boolean
}) {
  return (
    <WorkspaceContext.Provider
      value={{
        accountPreferencesEnabled,
        mode,
        privilegeMode,
        scope,
        uploadIngestionEnabled,
        uploadsEnabled,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceScope() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspaceScope must be used within WorkspaceProvider")
  }
  return context.scope
}

export function useWorkspaceMode() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspaceMode must be used within WorkspaceProvider")
  }
  return context.mode
}

export function useWorkspacePrivilegeMode() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error(
      "useWorkspacePrivilegeMode must be used within WorkspaceProvider"
    )
  }
  return context.privilegeMode
}

export function useUploadsEnabled() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useUploadsEnabled must be used within WorkspaceProvider")
  }
  return context.uploadsEnabled
}

export function useUploadIngestionEnabled() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error(
      "useUploadIngestionEnabled must be used within WorkspaceProvider"
    )
  }
  return context.uploadIngestionEnabled
}

export function useAdministrationScope() {
  return identityScopeWithPrivilegeMode(useWorkspaceScope(), "elevated")
}

export function useAccountPreferencesEnabled() {
  return useContext(WorkspaceContext)?.accountPreferencesEnabled ?? false
}

export function useOptionalWorkspaceScope() {
  return useContext(WorkspaceContext)?.scope
}
