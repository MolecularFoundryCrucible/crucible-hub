import { useMutation, useQueryClient } from "@tanstack/react-query"

import { notifyError, notifySuccess } from "@/components/crucible/notifications"
import { DelayedPendingIcon } from "@/components/crucible/pending-icon"
import { Button } from "@/components/ui/button"
import { syncWorkspaceAccountProjectsFn } from "@/data/crucible/account.functions"
import type { WorkspaceProjectSyncResult } from "@/data/crucible/workspace-source"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

export function projectSyncSummary(result: WorkspaceProjectSyncResult): {
  title: string
  description?: string
} {
  if (!result.orcid) {
    return {
      title: "No ORCID to look up",
      description:
        "Add ORCID as a sign-in method to find projects from your proposals.",
    }
  }
  const notFound = result.projectsNotFound.length
    ? `${plural(result.projectsNotFound.length, "proposal has", "proposals have")} no Crucible project yet.`
    : undefined
  if (result.projectsAdded.length) {
    return {
      title: `Added to ${plural(result.projectsAdded.length, "project", "projects")}`,
      description: [result.projectsAdded.join(", "), notFound]
        .filter(Boolean)
        .join(". "),
    }
  }
  return {
    title: "No new projects",
    description:
      notFound ??
      (result.projectsAlreadyMember.length
        ? "You're already in every project from your proposals."
        : "None of your proposals has a Crucible project yet."),
  }
}

export function SyncProjectsButton({ scope }: { scope: IdentityScope }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await syncWorkspaceAccountProjectsFn({
          data: { scenario: fixtureScenarioFromScope(scope) },
        })
      ),
    onSuccess: (result) => {
      const summary = projectSyncSummary(result)
      notifySuccess(summary.title, summary.description)
      if (result.projectsAdded.length) {
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.projectQueries(scope),
        })
      }
    },
    onError: (cause) => {
      notifyError(
        "Projects could not be synced",
        hubErrorMessage(cause, "Try again in a moment.")
      )
    },
  })

  return (
    <Button
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      variant="outline"
    >
      <DelayedPendingIcon
        data-icon="inline-start"
        pending={mutation.isPending}
      />
      Sync from proposals
    </Button>
  )
}
