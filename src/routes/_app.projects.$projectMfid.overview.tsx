import { useState } from "react"
import type { ReactNode } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { EditResourceIcon } from "@/components/crucible/icons"
import {
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import {
  ScientificMetadataExpansionAction,
  ScientificMetadataViewer,
  useScientificMetadataExpansion,
} from "@/components/crucible/scientific-metadata"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidValue } from "@/components/crucible/mfid-value"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { ProjectMembers } from "@/components/crucible/project-members"
import { PersonLink } from "@/components/crucible/person-link"
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
        {editing ? (
          <ProjectSettingsForm
            mode={mode}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
            project={project}
            scope={scope}
          />
        ) : (
          <Card>
            <CardHeader actionLayout="inline">
              <CardTitle>Project details</CardTitle>
              {project.capabilities?.can_edit === true ? (
                <CardAction>
                  <Button onClick={() => setEditing(true)} variant="outline">
                    <EditResourceIcon data-icon="inline-start" />
                    Edit project
                  </Button>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Project ID" value={project.project_id} />
                <Field label="Organization" value={project.organization} />
                <ProjectLead project={project} />
                <ProjectMfid project={project} />
                <Field
                  label="Created"
                  value={
                    <LocalDateTime fallback="-" value={project.creation_time} />
                  }
                />
                <Field
                  label="Updated"
                  value={
                    <LocalDateTime
                      fallback="-"
                      value={project.modification_time}
                    />
                  }
                />
              </dl>
            </CardContent>
          </Card>
        )}
      </ContentGridItem>

      <ContentGridItem span="narrow">
        <ProjectMetadata metadata={project.scientific_metadata} />
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
        <ScientificMetadataViewer expansion={expansion} metadata={metadata} />
      </CardContent>
    </Card>
  )
}

function ProjectLead({ project }: { project: WorkspaceProject }) {
  return (
    <div className="min-w-0 sm:col-span-2">
      <dt className="text-supporting text-muted-foreground">Project lead</dt>
      <dd className="mt-1 text-body break-words">
        {"status" in project && project.lead ? (
          <PersonLink person={project.lead} />
        ) : "status" in project && project.project_lead_orcid ? (
          <PersonLink
            person={{
              name: project.project_lead_orcid,
              unique_id: project.project_lead_orcid,
            }}
          />
        ) : (
          "-"
        )}
      </dd>
    </div>
  )
}

function ProjectMfid({ project }: { project: WorkspaceProject }) {
  return (
    <div className="min-w-0">
      <dt className="text-supporting text-muted-foreground">MFID</dt>
      <dd className="mt-1">
        <MfidValue value={project.unique_id} />
      </dd>
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-supporting text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-body break-words">{value ?? "-"}</dd>
    </div>
  )
}
