import { createContext, useContext } from "react"

import type { IdentityScope } from "@/data/crucible/query-keys"
import type { WorkspaceMode } from "@/data/crucible/workspace-source"

type WorkspaceContextValue = {
  mode: WorkspaceMode
  scope: IdentityScope
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
)

export function WorkspaceProvider({
  children,
  mode,
  scope,
}: {
  children: React.ReactNode
  mode: WorkspaceMode
  scope: IdentityScope
}) {
  return (
    <WorkspaceContext.Provider value={{ mode, scope }}>
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
