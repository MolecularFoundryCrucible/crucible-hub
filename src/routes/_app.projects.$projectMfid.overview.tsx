import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { EditResourceIcon } from "@/components/crucible/icons"
import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidQrCode } from "@/components/crucible/mfid-qr-code"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceStatusBadge } from "@/components/crucible/resource-status-badge"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { SummaryFieldIcon } from "@/components/crucible/summary-field-icon"
import {
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import {
  ScientificMetadataExpansionAction,
  ScientificMetadataViewer,
  useScientificMetadataExpansion,
} from "@/components/crucible/scientific-metadata"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { ProjectMembers } from "@/components/crucible/project-members"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import type {
  WorkspaceProject,
  WorkspaceScientificMetadata,
} from "@/data/crucible/workspace-source"
import { ProjectSettingsForm } from "@/features/management-settings/settings-forms"
import { projectMembershipActions } from "@/features/project-membership/project-membership-access"

type ProjectDetail = Extract<WorkspaceProject, { status: string | null }>

export const Route = createFileRoute("/_app/projects/$projectMfid/overview")({
  component: ProjectOverviewPage,
})

function ProjectOverviewPage() {
  const { projectMfid } = Route.useParams()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const [editing, setEditing] = useState(false)
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
            <div className="min-w-0">
              <dt className="text-label text-muted-foreground">Project ID</dt>
              <dd className="mt-1 text-body break-words">
                {project.project_id || "-"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label text-muted-foreground">MFID</dt>
              <dd className="mt-1">
                <MfidValue value={project.unique_id} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    )
  }

  const { canUseMembership } = projectMembershipActions(project, scope[2])

  return (
    <ContentGrid variant="detail">
      <ContentGridItem span="wide">
        {editing ? (
          <ProjectSettingsForm
            mode={mode}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
            project={project}
            scope={scope}
          />
        ) : (
          <ProjectSummary
            onEdit={
              project.capabilities?.can_edit === true
                ? () => setEditing(true)
                : undefined
            }
            project={project}
          />
        )}
      </ContentGridItem>

      <ContentGridItem span="narrow">
        <ProjectIdentity project={project} />
      </ContentGridItem>

      <ContentGridItem span="full">
        <ProjectMetadata metadata={project.scientific_metadata} />
      </ContentGridItem>

      <ContentGridItem span="full">
        <ProjectMembers
          manageMembers={canUseMembership}
          members={project.members}
          projectMfid={project.unique_id}
        />
      </ContentGridItem>
    </ContentGrid>
  )
}

function ProjectSummary({
  onEdit,
  project,
}: {
  onEdit?: () => void
  project: ProjectDetail
}) {
  return (
    <Card>
      <CardHeader actionLayout="inline">
        <CardTitle>Summary</CardTitle>
        {onEdit ? (
          <CardAction>
            <Button onClick={onEdit} variant="outline">
              <EditResourceIcon data-icon="inline-start" />
              Edit project
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-label text-muted-foreground">Organization</dt>
            <dd className="mt-1 flex min-w-0 items-start gap-2 text-body break-words">
              <SummaryFieldIcon type="organization" />
              <span className="min-w-0">{project.organization || "-"}</span>
            </dd>
          </div>
          {project.status ? (
            <div className="min-w-0">
              <dt className="text-label text-muted-foreground">Status</dt>
              <dd className="mt-1 flex min-w-0 items-start gap-2 text-body break-words">
                <SummaryFieldIcon type="status" />
                <span className="min-w-0">
                  <ResourceStatusBadge status={project.status} />
                </span>
              </dd>
            </div>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  )
}

function ProjectIdentity({ project }: { project: ProjectDetail }) {
  return (
    <Card>
      <CardContent>
        <ContentGrid variant="identity">
          <div className="min-w-0">
            <CardTitle>Identity</CardTitle>
            <dl className="mt-4 grid gap-4">
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">Project ID</dt>
                <dd className="mt-1 flex items-start gap-2 text-body break-words">
                  <ResourceTypeIcon
                    className="mt-0.5 size-4 shrink-0"
                    type="project"
                  />
                  {project.project_id || "-"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">MFID</dt>
                <dd className="mt-1">
                  <MfidValue value={project.unique_id} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">Lead</dt>
                <dd className="mt-1 flex items-start gap-2 text-body">
                  <IdentityFieldIcon type="owner" />
                  {project.lead ? (
                    <PersonLink nameStyle="abbreviated" person={project.lead} />
                  ) : project.project_lead_orcid ? (
                    <PersonLink
                      nameStyle="abbreviated"
                      person={{
                        name: project.project_lead_orcid,
                        unique_id: project.project_lead_orcid,
                      }}
                    />
                  ) : (
                    "Unknown lead"
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <div className="content-grid-identity-qr">
            <MfidQrCode value={project.unique_id} />
          </div>
          <dl className="content-grid-identity-timestamps grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-label text-muted-foreground">Created</dt>
              <dd className="mt-1 flex items-start gap-2 text-body">
                <IdentityFieldIcon type="created" />
                <LocalDateTime fallback="-" value={project.creation_time} />
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Updated</dt>
              <dd className="mt-1 flex items-start gap-2 text-body">
                <IdentityFieldIcon type="updated" />
                <LocalDateTime fallback="-" value={project.modification_time} />
              </dd>
            </div>
          </dl>
        </ContentGrid>
      </CardContent>
    </Card>
  )
}

function ProjectMetadata({
  metadata,
}: {
  metadata: WorkspaceScientificMetadata | null
}) {
  const expansion = useScientificMetadataExpansion(metadata)
  return (
    <Card>
      <CardHeader actionLayout="inline">
        <CardTitle>Scientific metadata</CardTitle>
        {expansion.canExpand ? (
          <CardAction>
            <ScientificMetadataExpansionAction expansion={expansion} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <ScientificMetadataViewer
          emptyMessage="This project does not currently expose scientific metadata."
          expansion={expansion}
          metadata={metadata}
        />
      </CardContent>
    </Card>
  )
}
