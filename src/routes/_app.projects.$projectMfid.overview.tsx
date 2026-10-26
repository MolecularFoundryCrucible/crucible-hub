import { useState } from "react"
import { ScientificMetadataEditor } from "@/features/resource-metadata/scientific-metadata-editor"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { EditableCardTrigger } from "@/components/crucible/editable-card-actions"
import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidQrCode } from "@/components/crucible/mfid-qr-code"
import { PrintLabelButton } from "@/features/label-printing/print-label-dialog"
import { resourceDisplayName } from "@/lib/resource-name"
import { CopyMfidButton, MfidValue } from "@/components/crucible/mfid-value"
import { PersonLink } from "@/components/crucible/person-link"
import {
  ProjectOverviewPending,
  ResourceTabLoadError,
} from "@/components/crucible/resource-tab-state"
import { ResourceStatusBadge } from "@/components/crucible/resource-status-badge"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  SummaryFieldIcon,
  SummaryFieldItem,
} from "@/components/crucible/summary-field-icon"
import { ContentGrid } from "@/components/crucible/content-layout"
import { EntityOverviewLayout } from "@/components/crucible/entity-overview-layout"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import {
  ProjectMembers,
  ProjectRoleBadge,
} from "@/components/crucible/project-members"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import type { WorkspaceProject } from "@/data/crucible/workspace-source"
import { ProjectSettingsForm } from "@/features/management-settings/settings-forms"
import { projectMembershipActions } from "@/features/project-membership/project-membership-access"

type ProjectDetail = Extract<WorkspaceProject, { status: string | null }>

export const Route = createFileRoute("/_app/projects/$projectMfid/overview")({
  pendingComponent: ProjectOverviewPending,
  errorComponent: ResourceTabLoadError,
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

  const { canUseMembership } = projectMembershipActions(project, scope[2])
  const userRole =
    project.role ??
    (scope[2] &&
    (project.lead?.unique_id === scope[2] ||
      project.project_lead_orcid === scope[2])
      ? "owner"
      : (project.members?.find((m) => m.unique_id === scope[2])?.role ?? null))

  return (
    <EntityOverviewLayout
      identity={<ProjectIdentity project={project} userRole={userRole} />}
      metadata={
        <ScientificMetadataEditor
          mode={mode}
          resource={{
            capabilities: project.capabilities,
            kind: "project",
            scientific_metadata: project.scientific_metadata,
            unique_id: project.unique_id,
          }}
          scope={scope}
        />
      }
      people={
        <ProjectMembers
          manageMembers={canUseMembership}
          members={project.members}
          projectMfid={project.unique_id}
        />
      }
      summary={
        editing ? (
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
        )
      }
    />
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
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        {onEdit ? (
          <CardAction>
            <EditableCardTrigger label="Edit project" onClick={onEdit} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 @fields:grid-cols-2">
          <SummaryFieldItem
            className="@fields:col-span-2"
            icon={<SummaryFieldIcon type="organization" />}
            label="Organization"
          >
            {project.organization || "-"}
          </SummaryFieldItem>
          {project.status ? (
            <SummaryFieldItem
              icon={<SummaryFieldIcon type="status" />}
              label="Status"
            >
              <ResourceStatusBadge status={project.status} />
            </SummaryFieldItem>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  )
}

function ProjectIdentity({
  project,
  userRole,
}: {
  project: ProjectDetail
  userRole?: string | null
}) {
  return (
    <Card>
      <CardContent>
        <ContentGrid variant="identity">
          <div className="min-w-0">
            <CardTitle>Identity</CardTitle>
            <dl className="mt-4 grid gap-4">
              <SummaryFieldItem
                icon={
                  <ResourceTypeIcon
                    className="mt-0.5 size-4 shrink-0"
                    type="project"
                  />
                }
                label="Project ID"
              >
                {project.project_id || "-"}
              </SummaryFieldItem>
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">MFID</dt>
                <dd className="mt-1">
                  <MfidValue copyable={false} value={project.unique_id} />
                </dd>
              </div>
              <div className={userRole ? "grid grid-cols-2 gap-4" : "min-w-0"}>
                <div className="min-w-0">
                  <dt className="text-label text-muted-foreground">Lead</dt>
                  <dd className="mt-1 flex items-start gap-2 text-body">
                    <IdentityFieldIcon type="owner" />
                    {project.lead ? (
                      <PersonLink
                        nameStyle="abbreviated"
                        person={project.lead}
                      />
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
                {userRole ? (
                  <div className="min-w-0">
                    <dt className="text-label text-muted-foreground">
                      Your role
                    </dt>
                    <dd className="mt-1 flex items-start gap-2 text-body">
                      <ProjectRoleBadge role={userRole} />
                    </dd>
                  </div>
                ) : null}
              </div>
            </dl>
          </div>
          <div className="content-grid-identity-qr">
            <MfidQrCode
              actions={
                <>
                  <CopyMfidButton size="icon-sm" value={project.unique_id} />
                  <PrintLabelButton
                    mfid={project.unique_id}
                    name={resourceDisplayName("project", project.title, {
                      identifier: project.project_id,
                      mfid: project.unique_id,
                    })}
                    variant="icon"
                  />
                </>
              }
              dialogActions={
                <PrintLabelButton
                  mfid={project.unique_id}
                  name={resourceDisplayName("project", project.title, {
                    identifier: project.project_id,
                    mfid: project.unique_id,
                  })}
                />
              }
              value={project.unique_id}
            />
          </div>
          <dl className="content-grid-identity-timestamps grid grid-cols-2 gap-4">
            <SummaryFieldItem
              icon={<IdentityFieldIcon type="created" />}
              label="Created"
            >
              <LocalDateTime fallback="-" value={project.creation_time} />
            </SummaryFieldItem>
            <SummaryFieldItem
              icon={<IdentityFieldIcon type="updated" />}
              label="Updated"
            >
              <LocalDateTime fallback="-" value={project.modification_time} />
            </SummaryFieldItem>
          </dl>
        </ContentGrid>
      </CardContent>
    </Card>
  )
}
