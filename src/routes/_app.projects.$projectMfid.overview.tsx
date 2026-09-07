import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { EditResourceIcon } from "@/components/crucible/icons"
import {
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import { ScientificMetadata } from "@/components/crucible/scientific-metadata"
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
import type { WorkspaceProject } from "@/data/crucible/workspace-source"
import { ProjectSettingsForm } from "@/features/management-settings/settings-forms"
import { projectMembershipActions } from "@/features/project-membership/project-membership-access"
import { formatLocalDateTime } from "@/lib/format"

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
            <CardHeader>
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
                  value={formatLocalDateTime(project.creation_time)}
                />
                <Field
                  label="Updated"
                  value={formatLocalDateTime(project.modification_time)}
                />
              </dl>
            </CardContent>
          </Card>
        )}
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
    <div className="min-w-0 sm:col-span-2">
      <dt className="text-supporting text-muted-foreground">Project lead</dt>
      <dd className="mt-1 text-body break-words">
        {"status" in project && project.lead ? (
          <PersonLink
            name={`${project.lead.first_name} ${project.lead.last_name}`}
            personId={project.lead.unique_id}
            username={project.lead.username}
          >
            {project.lead.first_name} {project.lead.last_name}
          </PersonLink>
        ) : "status" in project && project.project_lead_orcid ? (
          <PersonLink
            name={project.project_lead_orcid}
            personId={project.project_lead_orcid}
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
            ? "mt-1 font-mono text-identifier break-all"
            : "mt-1 text-body break-words"
        }
      >
        {value ?? "-"}
      </dd>
    </div>
  )
}
