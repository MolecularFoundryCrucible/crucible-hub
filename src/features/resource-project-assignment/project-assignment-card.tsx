import { useId, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { resourceDetailDisplayName } from "@/lib/resource-name"

import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { ManagementAction } from "@/components/crucible/management-action"
import { ResourceSearchCombobox } from "@/components/crucible/resource-search-combobox"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { resourceAccessQueryOptions } from "@/data/crucible/access.queries"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { isPrimaryProjectAccessGrant } from "@/data/crucible/resource-access"
import {
  confirmWorkspaceResourceProjectAssignment,
  previewWorkspaceResourceProjectAssignment,
} from "@/data/crucible/resources.functions"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceProjectReassignment,
  WorkspaceResourceAccessGrant,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

type AssignableResource = Extract<
  WorkspaceResourceDetail,
  { kind: "sample" | "dataset" }
>

export function ProjectAssignmentCard({
  mode,
  onSuccess,
  presentation,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  onSuccess?: (result: WorkspaceProjectReassignment) => void
  presentation?: "card" | "row"
  resource: AssignableResource
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const searchInputId = useId()
  const [chooserOpen, setChooserOpen] = useState(false)
  const [projectQuery, setProjectQuery] = useState("")
  const [preview, setPreview] = useState<WorkspaceProjectReassignment>()
  const [selectedProject, setSelectedProject] =
    useState<WorkspaceSearchResult>()
  const [error, setError] = useState<string>()
  const previewMutation = useMutation({
    mutationFn: async (projectMfid: string) =>
      unwrapHubResult(
        await previewWorkspaceResourceProjectAssignment({
          data: {
            projectMfid,
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const confirmMutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await confirmWorkspaceResourceProjectAssignment({
          data: {
            projectMfid: selectedProject?.unique_id ?? "",
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })

  async function chooseProject(project: WorkspaceSearchResult) {
    setError(undefined)
    setSelectedProject(project)
    try {
      setPreview(await previewMutation.mutateAsync(project.unique_id))
      setChooserOpen(false)
    } catch (caught) {
      setSelectedProject(undefined)
      setError(operationError(caught, "preview this project assignment"))
    }
  }

  async function confirm() {
    if (!preview) return
    setError(undefined)
    try {
      const result = await confirmMutation.mutateAsync()
      applyConfirmedProject(result)
      invalidateProjectQueries()
      setPreview(undefined)
      setSelectedProject(undefined)
      onSuccess?.(result)
    } catch (caught) {
      setError(operationError(caught, "assign this resource to the project"))
    }
  }

  function applyConfirmedProject(result: WorkspaceProjectReassignment) {
    if (!selectedProject) return
    queryClient.setQueryData<WorkspaceResourceDetail | null>(
      resourceQueryOptions(scope, resource.unique_id).queryKey,
      (current) =>
        current && (current.kind === "sample" || current.kind === "dataset")
          ? {
              ...current,
              project: {
                project_id: result.new_project_id,
                title: selectedProject.name,
                unique_id: selectedProject.unique_id,
              },
              project_id: result.new_project_id,
            }
          : current
    )
    queryClient.setQueryData<readonly WorkspaceResourceAccessGrant[]>(
      resourceAccessQueryOptions(scope, resource.unique_id).queryKey,
      (current) => {
        if (!current) return current
        const projectGrant = current.find((grant) =>
          isPrimaryProjectAccessGrant(resource, grant)
        )
        return [
          ...current.filter(
            (grant) => !isPrimaryProjectAccessGrant(resource, grant)
          ),
          {
            display_name: selectedProject.name,
            permission: projectGrant?.permission ?? "viewer",
            principal_id: selectedProject.unique_id,
            principal_type: "project",
            slug: result.new_project_id,
          },
        ]
      }
    )
  }

  function invalidateProjectQueries() {
    if (mode !== "api") return
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: resourceQueryOptions(scope, resource.unique_id).queryKey,
    })
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: resourceAccessQueryOptions(scope, resource.unique_id).queryKey,
    })
    void queryClient.invalidateQueries({
      queryKey:
        resource.kind === "sample"
          ? crucibleKeys.sampleLists(scope)
          : crucibleKeys.datasetLists(scope),
    })
    for (const projectMfid of new Set(
      [resource.project?.unique_id, selectedProject?.unique_id].filter(
        (value): value is string => Boolean(value)
      )
    )) {
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: crucibleKeys.project(scope, projectMfid),
      })
    }
    void queryClient.invalidateQueries({
      queryKey: crucibleKeys.searches(scope),
    })
  }

  function closeChooser(nextOpen: boolean) {
    if (previewMutation.isPending) return
    setChooserOpen(nextOpen)
    if (!nextOpen) setProjectQuery("")
  }

  if (resource.capabilities?.can_manage_access !== true) return null

  return (
    <>
      <ManagementAction
        action={
          <Button onClick={() => setChooserOpen(true)} type="button">
            Choose project
          </Button>
        }
        description="Move this resource and its project access grant together."
        presentation={presentation}
        title="Transfer project"
      >
        {error && !chooserOpen && !preview ? (
          <p className="text-body text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </ManagementAction>
      <Dialog onOpenChange={closeChooser} open={chooserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a project</DialogTitle>
          </DialogHeader>
          <ResourceSearchCombobox
            disabled={previewMutation.isPending}
            excludedIds={
              resource.project?.unique_id ? [resource.project.unique_id] : []
            }
            id={searchInputId}
            kind="project"
            onQueryChange={setProjectQuery}
            onValueChange={(project) => {
              if (project) void chooseProject(project)
            }}
            query={projectQuery}
            scope={scope}
            value={undefined}
          />
          {error && chooserOpen ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        kind="alert"
        confirmLabel="Assign project"
        description={
          preview ? (
            <>
              <strong>{resourceDetailDisplayName(resource)}</strong> will move
              from {resource.project?.title ?? "no project"} to{" "}
              <strong>{selectedProject?.name ?? preview.new_project_id}</strong>
              .
            </>
          ) : null
        }
        error={error}
        onOpenChange={(open) => {
          if (!open && !confirmMutation.isPending) {
            setPreview(undefined)
            setSelectedProject(undefined)
            setError(undefined)
          }
        }}
        onConfirm={() => void confirm()}
        open={Boolean(preview)}
        pending={confirmMutation.isPending}
        pendingLabel="Assigning project"
        title="Assign to this project?"
      />
    </>
  )
}

function operationError(error: unknown, action: string) {
  return hubErrorMessage(error, `Could not ${action}. Try again.`)
}
