import { useId, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { SavingChangesIcon } from "@/components/crucible/icons"

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
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { resourceAccessQueryOptions } from "@/data/crucible/access.queries"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  confirmWorkspaceResourceProjectAssignment,
  previewWorkspaceResourceProjectAssignment,
} from "@/data/crucible/resources.functions"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import { searchQueryOptions } from "@/data/crucible/search.queries"
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
  className,
  mode,
  onSuccess,
  resource,
  scope,
}: {
  className?: string
  mode: "api" | "fixture"
  onSuccess?: (result: WorkspaceProjectReassignment) => void
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
  const normalizedQuery = projectQuery.trim()
  const search = useQuery({
    ...searchQueryOptions(scope, normalizedQuery, ["project"]),
    enabled: chooserOpen && normalizedQuery.length >= 3,
  })
  const projects =
    search.data?.groups.find((group) => group.kind === "project")?.items ?? []
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
        const projectGrant = current.find(
          (grant) => grant.principal_type === "project"
        )
        return [
          ...current.filter((grant) => grant.principal_type !== "project"),
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
    <Card className={className}>
      <CardHeader>
        <CardTitle>Transfer project</CardTitle>
        <CardDescription>
          Move this resource and its project access grant together.
        </CardDescription>
        <CardAction>
          <Button onClick={() => setChooserOpen(true)} type="button">
            Choose project
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-body text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
      <Dialog onOpenChange={closeChooser} open={chooserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a project</DialogTitle>
            <DialogDescription>
              Search for a project and select a candidate for server preview.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={searchInputId}>Search projects</FieldLabel>
            <Input
              autoComplete="off"
              id={searchInputId}
              onChange={(event) => setProjectQuery(event.target.value)}
              placeholder="Project name or identifier"
              type="search"
              value={projectQuery}
            />
          </Field>
          {normalizedQuery.length < 3 ? null : search.isPending ||
            search.isPlaceholderData ? (
            <p className="text-body text-muted-foreground" role="status">
              Searching projects...
            </p>
          ) : search.isError ? (
            <p className="text-body text-destructive" role="alert">
              Projects could not be searched.
            </p>
          ) : projects.length === 0 ? (
            <p className="text-body text-muted-foreground">
              No projects matched this search.
            </p>
          ) : (
            <ul
              aria-label="Project search results"
              className="flex flex-col gap-1"
            >
              {projects.map((project) => {
                const isCurrentProject =
                  project.unique_id === resource.project?.unique_id
                return (
                  <li key={project.unique_id}>
                    <Button
                      disabled={previewMutation.isPending || isCurrentProject}
                      onClick={() => void chooseProject(project)}
                      size="selection"
                      type="button"
                      variant="ghost"
                    >
                      <span className="text-left">
                        <span className="block text-label">
                          {project.name}
                          {isCurrentProject ? " (current project)" : ""}
                        </span>
                        {project.context ? (
                          <span className="block text-supporting text-muted-foreground">
                            {project.context}
                          </span>
                        ) : null}
                      </span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          {error && chooserOpen ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !confirmMutation.isPending) {
            setPreview(undefined)
            setSelectedProject(undefined)
            setError(undefined)
          }
        }}
        open={Boolean(preview)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign to this project?</AlertDialogTitle>
            <AlertDialogDescription>
              {preview ? (
                <>
                  <strong>{resource.name}</strong> will move from{" "}
                  {resource.project?.title ?? "no project"} to{" "}
                  <strong>
                    {selectedProject?.name ?? preview.new_project_id}
                  </strong>
                  .
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmMutation.isPending}
              onClick={() => void confirm()}
            >
              <SavingChangesIcon
                aria-hidden="true"
                className={
                  confirmMutation.isPending
                    ? "motion-safe:animate-spin"
                    : "invisible"
                }
                data-icon="inline-start"
              />
              Confirm assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function operationError(error: unknown, action: string) {
  if (error instanceof HubApiClientError) return error.message
  return `Could not ${action}. Try again.`
}
