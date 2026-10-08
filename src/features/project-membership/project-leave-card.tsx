import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { LeaveProjectIcon } from "@/components/crucible/icons"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { ManagementAction } from "@/components/crucible/management-action"
import { Button } from "@/components/ui/button"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { removeWorkspaceProjectMember } from "@/data/crucible/projects.functions"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceProject } from "@/data/crucible/workspace-source"
import { projectMembershipActions } from "./project-membership-access"
import type { MembershipProject } from "./project-membership-card"

export function ProjectLeaveCard({
  accountId,
  mode,
  onSuccess,
  presentation,
  project,
  scope,
}: {
  accountId: string
  mode: "api" | "fixture"
  onSuccess?: () => void
  presentation?: "card" | "row"
  project: MembershipProject
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const { canLeave, currentMember } = projectMembershipActions(
    project,
    accountId
  )

  if (!canLeave || !currentMember) return null
  const member = currentMember

  async function leaveProject() {
    setPending(true)
    setError(undefined)
    try {
      const nextMembers = unwrapHubResult(
        await removeWorkspaceProjectMember({
          data: {
            projectMfid: project.unique_id,
            scenario: fixtureScenarioFromScope(scope),
            userId: member.unique_id,
          },
        })
      )
      const detailQuery = projectQueryOptions(scope, project.unique_id)
      queryClient.setQueryData<WorkspaceProject>(
        detailQuery.queryKey,
        (current) =>
          current
            ? { ...current, members: nextMembers }
            : { ...project, members: nextMembers }
      )
      if (mode === "api") {
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.projectLists(scope),
        })
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.searches(scope),
        })
      }
      setOpen(false)
      onSuccess?.()
    } catch (caught) {
      setError(
        hubErrorMessage(caught, "Could not leave this project. Try again.")
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <ManagementAction
        action={
          <Button
            disabled={pending}
            onClick={() => {
              setError(undefined)
              setOpen(true)
            }}
            type="button"
            variant="destructive"
          >
            <LeaveProjectIcon aria-hidden="true" data-icon="inline-start" />
            Leave project
          </Button>
        }
        description="Remove your membership and access to this project and its shared resources."
        presentation={presentation}
        title="Leave project"
      />
      <ConfirmationDialog
        kind="alert"
        confirmLabel="Leave project"
        description="You will lose access to this project and its shared resources."
        error={error}
        onOpenChange={(nextOpen) => {
          if (pending) return
          setOpen(nextOpen)
          if (!nextOpen) setError(undefined)
        }}
        onConfirm={() => void leaveProject()}
        open={open}
        pending={pending}
        title="Leave project?"
        variant="destructive"
      />
    </>
  )
}
