import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

import { CopyIcon, CopySuccessIcon } from "@/components/crucible/icons"
import {
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import { ScientificMetadata } from "@/components/crucible/scientific-metadata"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { ProjectMembers } from "@/components/crucible/project-members"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import type { WorkspaceProject } from "@/data/crucible/workspace-source"
import { projectMembershipActions } from "@/features/project-membership/project-membership-access"
import { formatLocalDateTime } from "@/lib/format"

export const Route = createFileRoute("/_app/projects/$projectMfid/overview")({
  component: ProjectOverviewPage,
})

function ProjectOverviewPage() {
  const { projectMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const { data: project } = useSuspenseQuery(
    projectQueryOptions(scope, projectMfid)
  )

  if (!project) return null
  if (!("status" in project)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Limited project details</CardTitle>
          <CardDescription>
            Only the project reference is available to this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Project ID" value={project.project_id} />
            <ProjectMfid project={project} />
          </dl>
        </CardContent>
      </Card>
    )
  }

  const { canUseMembership } = projectMembershipActions(project, scope[2])

  return (
    <ContentGrid variant="detail">
      <ContentGridItem span="wide">
        <Card>
          <CardHeader>
            <CardTitle>Project details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Project ID" value={project.project_id} />
              <Field label="Organization" value={project.organization} />
              <ProjectLead project={project} />
              <ProjectMfid project={project} />
              <Field
                label="Created"
                value={formatLocalDateTime(project.creation_time)}
              />
              <Field
                label="Updated"
                value={formatLocalDateTime(project.modification_time)}
              />
            </dl>
          </CardContent>
        </Card>
      </ContentGridItem>

      <ContentGridItem span="narrow">
        <Card>
          <CardHeader>
            <CardTitle>Scientific metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <ScientificMetadata metadata={project.scientific_metadata} />
          </CardContent>
        </Card>
      </ContentGridItem>

      <ContentGridItem span="wide">
        <ProjectMembers
          manageMembers={canUseMembership}
          members={project.members}
          projectMfid={project.unique_id}
        />
      </ContentGridItem>
    </ContentGrid>
  )
}

function ProjectLead({ project }: { project: WorkspaceProject }) {
  return (
    <div className="min-w-0">
      <dt className="text-supporting text-muted-foreground">Project lead</dt>
      <dd className="mt-1 text-body break-words">
        {"status" in project && project.lead ? (
          <Link
            className="text-label hover:underline"
            params={{ personId: project.lead.unique_id }}
            to="/people/$personId"
          >
            {project.lead.first_name} {project.lead.last_name}
          </Link>
        ) : "status" in project && project.project_lead_orcid ? (
          <Link
            className="text-label hover:underline"
            params={{ personId: project.project_lead_orcid }}
            to="/people/$personId"
          >
            {project.project_lead_orcid}
          </Link>
        ) : (
          "-"
        )}
      </dd>
    </div>
  )
}

function ProjectMfid({ project }: { project: WorkspaceProject }) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle"
  )

  async function copyMfid() {
    try {
      await navigator.clipboard.writeText(project.unique_id)
      setCopyState("success")
    } catch {
      setCopyState("error")
    }
  }

  const copyLabel =
    copyState === "success"
      ? "MFID copied"
      : copyState === "error"
        ? "Copy MFID failed"
        : "Copy MFID"

  return (
    <div className="min-w-0">
      <dt className="text-supporting text-muted-foreground">MFID</dt>
      <dd className="mt-1 flex min-w-0 items-start gap-2 text-body">
        <span className="min-w-0 font-mono text-supporting break-all">
          {project.unique_id}
        </span>
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <Button
              aria-label={copyLabel}
              className="shrink-0"
              onClick={() => void copyMfid()}
              size="icon-sm"
              variant="outline"
            >
              {copyState === "success" ? (
                <CopySuccessIcon aria-hidden="true" />
              ) : (
                <CopyIcon aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copyLabel}</TooltipContent>
        </Tooltip>
      </dd>
      {copyState === "error" ? (
        <span className="sr-only" role="alert">
          Could not copy MFID. Try again.
        </span>
      ) : null}
    </div>
  )
}

function Field({
  label,
  mono = false,
  value,
}: {
  label: string
  mono?: boolean
  value: string | null
}) {
  return (
    <div className="min-w-0">
      <dt className="text-supporting text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "mt-1 font-mono text-supporting break-all"
            : "mt-1 text-body break-words"
        }
      >
        {value ?? "-"}
      </dd>
    </div>
  )
}
