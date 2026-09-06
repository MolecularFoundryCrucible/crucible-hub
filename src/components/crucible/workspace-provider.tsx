import { createContext, useContext } from "react"

import type { IdentityScope } from "@/data/crucible/query-keys"
import type {
  WorkspaceContent,
  WorkspaceMode,
} from "@/data/crucible/workspace-source"

type WorkspaceContextValue = {
  mode: WorkspaceMode
  scope: IdentityScope
  workspace: WorkspaceContent
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
)

export function WorkspaceProvider({
  children,
  mode,
  scope,
  workspace,
}: {
  children: React.ReactNode
  mode: WorkspaceMode
  scope: IdentityScope
  workspace: WorkspaceContent
}) {
  return (
    <WorkspaceContext.Provider value={{ mode, scope, workspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider")
  }
  return context.workspace
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
