import { useEffect, useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  COLLAPSED_LIST_LIMIT,
  ListExpansionToggle,
} from "@/components/crucible/list-expansion-toggle"
import { PanelState } from "@/components/crucible/collection-state"
import { PersonLink } from "@/components/crucible/person-link"
import {
  ProjectRoleBadge,
  sortProjectMembers,
} from "@/components/crucible/project-members"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { SummaryFieldItem } from "@/components/crucible/summary-field-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Skeleton } from "@/components/ui/skeleton"
import {
  datasetsQueryOptions,
  samplesQueryOptions,
} from "@/data/crucible/data.queries"
import { projectQueryOptions } from "@/data/crucible/projects.queries"

/**
 * What a project preview adds to its context: how much data it holds and who
 * works on it. Three requests: the project with its members, which the
 * project page reuses, and one-row sample and dataset pages for their totals.
 */
export function InspectorProjectOverview({
  projectMfid,
}: {
  projectMfid: string
}) {
  return (
    <>
      <InspectorProjectData projectMfid={projectMfid} />
      <InspectorProjectMembers projectMfid={projectMfid} />
    </>
  )
}

function InspectorProjectData({ projectMfid }: { projectMfid: string }) {
  const scope = useWorkspaceScope()
  const filters = {
    includeTotal: true,
    limit: 1,
    projectMfid,
    projectScope: "all",
  } as const
  const samples = useQuery(samplesQueryOptions(scope, filters))
  const datasets = useQuery(datasetsQueryOptions(scope, filters))

  return (
    <section
      aria-labelledby="inspector-project-data-heading"
      className="border-t pt-4"
    >
      <h3
        className="mb-3 text-title-section"
        id="inspector-project-data-heading"
      >
        Data
      </h3>
      <dl className="grid min-w-0 grid-cols-2 gap-3">
        <SummaryFieldItem
          icon={<ResourceTypeIcon className="mt-0.5" type="sample" />}
          label="Samples"
        >
          <DataTotal result={samples} />
        </SummaryFieldItem>
        <SummaryFieldItem
          icon={<ResourceTypeIcon className="mt-0.5" type="dataset" />}
          label="Datasets"
        >
          <DataTotal result={datasets} />
        </SummaryFieldItem>
      </dl>
    </section>
  )
}

function DataTotal({
  result,
}: {
  result: { data?: { total: number | null }; isPending: boolean }
}) {
  if (result.isPending) return <Skeleton className="mt-0.5 h-4 w-10" />
  const total = result.data?.total
  return (
    <span className="tabular-nums">
      {total === null || total === undefined ? "-" : total.toLocaleString()}
    </span>
  )
}

function InspectorProjectMembers({ projectMfid }: { projectMfid: string }) {
  const scope = useWorkspaceScope()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const result = useQuery(projectQueryOptions(scope, projectMfid))
  const project = result.data
  const members = project?.members ? sortProjectMembers(project.members) : null

  useEffect(() => setExpanded(false), [projectMfid])

  const visible = expanded ? members : members?.slice(0, COLLAPSED_LIST_LIMIT)

  return (
    <section
      aria-labelledby="inspector-project-members-heading"
      className="border-t pt-4"
    >
      <h3
        className="mb-3 text-title-section"
        id="inspector-project-members-heading"
      >
        Members{members?.length ? ` (${members.length})` : ""}
      </h3>
      {result.isPending ? (
        <div className="grid gap-3">
          {Array.from({ length: 2 }, (_, index) => (
            <div className="flex items-center gap-2" key={index}>
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      ) : result.isError && !project ? (
        <PanelState
          retry={() => void result.refetch()}
          role="alert"
          title="Members could not be loaded"
        />
      ) : (
        <div className="grid gap-3">
          {visible?.length ? (
            <div>
              <ul className="grid gap-2" id={listId}>
                {visible.map((member) => (
                  <li
                    className="flex min-w-0 items-center gap-2"
                    key={member.unique_id}
                  >
                    <PersonLink
                      className="min-w-0 flex-1"
                      person={member}
                      presentation="avatar"
                      size="sm"
                    />
                    <ProjectRoleBadge role={member.role} />
                  </li>
                ))}
              </ul>
              {members && members.length > COLLAPSED_LIST_LIMIT ? (
                <div className="mt-1 -ml-1.5 flex">
                  <ListExpansionToggle
                    controls={listId}
                    expanded={expanded}
                    noun="members"
                    onExpandedChange={setExpanded}
                    total={members.length}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-body text-muted-foreground">No members</p>
          )}
        </div>
      )}
    </section>
  )
}
