import { createContext, useContext } from "react"

import { identityScopeWithPrivilegeMode } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import type { WorkspaceMode } from "@/data/crucible/workspace-source"

type WorkspaceContextValue = {
  mode: WorkspaceMode
  privilegeMode: WorkspacePrivilegeMode
  scope: IdentityScope
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
)

export function WorkspaceProvider({
  children,
  mode,
  scope,
  privilegeMode = scope[3],
}: {
  children: React.ReactNode
  mode: WorkspaceMode
  privilegeMode?: WorkspacePrivilegeMode
  scope: IdentityScope
}) {
  return (
    <WorkspaceContext.Provider value={{ mode, privilegeMode, scope }}>
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

export function useAdministrationScope() {
  return identityScopeWithPrivilegeMode(useWorkspaceScope(), "elevated")
}
