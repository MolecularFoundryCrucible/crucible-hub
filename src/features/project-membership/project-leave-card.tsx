import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import {
  LeaveProjectIcon,
  SavingChangesIcon,
} from "@/components/crucible/icons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { removeWorkspaceProjectMember } from "@/data/crucible/projects.functions"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceProject } from "@/data/crucible/workspace-source"
import { projectMembershipActions } from "./project-membership-access"
import type { MembershipProject } from "./project-membership-card"

export function ProjectLeaveCard({
  accountId,
  className,
  mode,
  onSuccess,
  project,
  scope,
}: {
  accountId: string
  className?: string
  mode: "api" | "fixture"
  onSuccess?: () => void
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
        caught instanceof HubApiClientError
          ? caught.message
          : "Could not leave this project. Try again."
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle>Leave project</CardTitle>
          <CardDescription>
            Remove your membership and access to this project and its shared
            resources.
          </CardDescription>
          <CardAction>
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
          </CardAction>
        </CardHeader>
      </Card>
      <AlertDialog
        onOpenChange={(nextOpen) => {
          if (pending) return
          setOpen(nextOpen)
          if (!nextOpen) setError(undefined)
        }}
        open={open}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave project?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this project and its shared resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                void leaveProject()
              }}
              variant="destructive"
            >
              {pending ? (
                <SavingChangesIcon
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              Leave project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
