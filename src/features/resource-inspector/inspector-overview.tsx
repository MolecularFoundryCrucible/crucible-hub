import { useEffect, useId, useState } from "react"
import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  AccessRoleBadge,
  sortAccessGrants,
} from "@/components/crucible/access-role-badge"
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
import { instrumentMembersQueryOptions } from "@/data/crucible/instruments.queries"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { grantKey } from "@/data/crucible/resource-access"
import { InstrumentMemberIdentity } from "@/features/instrument-people/instrument-people-card"

type TotalResult = { data?: { total: number | null }; isPending: boolean }

/**
 * A project preview's data totals and members. The members come from the
 * project request the preview already made; each total is a one-row request.
 */
export function InspectorProjectOverview({
  projectMfid,
}: {
  projectMfid: string
}) {
  const scope = useWorkspaceScope()
  const filters = {
    includeTotal: true,
    limit: 1,
    projectMfid,
    projectScope: "all",
  } as const
  const samples = useQuery(samplesQueryOptions(scope, filters))
  const datasets = useQuery(datasetsQueryOptions(scope, filters))
  const project = useQuery(projectQueryOptions(scope, projectMfid))
  const members = project.data?.members
    ? sortProjectMembers(project.data.members)
    : null

  return (
    <>
      <InspectorTotals
        totals={[
          { kind: "sample", label: "Samples", result: samples },
          { kind: "dataset", label: "Datasets", result: datasets },
        ]}
      />
      <InspectorPeople
        entries={members?.map((member) => ({
          key: member.unique_id,
          person: (
            <PersonLink
              className="min-w-0 flex-1"
              person={member}
              presentation="avatar"
            />
          ),
          role: <ProjectRoleBadge role={member.role} />,
        }))}
        error={project.isError && !project.data}
        pending={project.isPending}
        resetKey={projectMfid}
        retry={() => void project.refetch()}
        title="Members"
      />
    </>
  )
}

/** An instrument preview's dataset total and the people and projects on it. */
export function InspectorInstrumentOverview({
  instrumentMfid,
}: {
  instrumentMfid: string
}) {
  const scope = useWorkspaceScope()
  const datasets = useQuery(
    datasetsQueryOptions(scope, {
      includeTotal: true,
      instrumentMfid,
      limit: 1,
    })
  )
  const people = useQuery(instrumentMembersQueryOptions(scope, instrumentMfid))

  return (
    <>
      <InspectorTotals
        totals={[{ kind: "dataset", label: "Datasets", result: datasets }]}
      />
      <InspectorPeople
        entries={
          people.data
            ? sortAccessGrants(people.data).map((grant) => ({
                key: grantKey(grant),
                person: <InstrumentMemberIdentity grant={grant} />,
                role: (
                  <AccessRoleBadge
                    label={grant.permission === "owner" ? "Manager" : undefined}
                    role={grant.permission}
                  />
                ),
              }))
            : undefined
        }
        error={people.isError && !people.data}
        pending={people.isPending}
        resetKey={instrumentMfid}
        retry={() => void people.refetch()}
        title="People"
      />
    </>
  )
}

function InspectorTotals({
  totals,
}: {
  totals: readonly {
    kind: "dataset" | "sample"
    label: string
    result: TotalResult
  }[]
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="border-t pt-4">
      <h3 className="mb-3 text-title-section" id={headingId}>
        Data
      </h3>
      <dl className="grid min-w-0 grid-cols-2 gap-3">
        {totals.map((total) => (
          <SummaryFieldItem
            icon={<ResourceTypeIcon className="mt-0.5" type={total.kind} />}
            key={total.label}
            label={total.label}
          >
            {total.result.isPending ? (
              <Skeleton className="mt-0.5 h-4 w-10" />
            ) : (
              <span className="tabular-nums">
                {total.result.data?.total?.toLocaleString() ?? "-"}
              </span>
            )}
          </SummaryFieldItem>
        ))}
      </dl>
    </section>
  )
}

function InspectorPeople({
  entries,
  error,
  pending,
  resetKey,
  retry,
  title,
}: {
  entries:
    readonly { key: string; person: ReactNode; role: ReactNode }[] | undefined
  error: boolean
  pending: boolean
  resetKey: string
  retry: () => void
  title: string
}) {
  const headingId = useId()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => setExpanded(false), [resetKey])

  const visible = expanded ? entries : entries?.slice(0, COLLAPSED_LIST_LIMIT)

  return (
    <section aria-labelledby={headingId} className="border-t pt-4">
      <h3 className="mb-3 text-title-section" id={headingId}>
        {title}
        {entries?.length ? ` (${entries.length})` : ""}
      </h3>
      {pending ? (
        <div className="grid gap-3">
          {Array.from({ length: 2 }, (_, index) => (
            <div className="flex items-center gap-2" key={index}>
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      ) : error ? (
        <PanelState
          retry={retry}
          role="alert"
          title={`${title} could not be loaded`}
        />
      ) : visible?.length ? (
        <div>
          <ul className="grid gap-2" id={listId}>
            {visible.map((entry) => (
              <li className="flex min-w-0 items-center gap-2" key={entry.key}>
                {entry.person}
                {entry.role}
              </li>
            ))}
          </ul>
          {entries && entries.length > COLLAPSED_LIST_LIMIT ? (
            <div className="mt-1 -ml-1.5 flex">
              <ListExpansionToggle
                controls={listId}
                expanded={expanded}
                noun={title.toLowerCase()}
                onExpandedChange={setExpanded}
                total={entries.length}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-body text-muted-foreground">
          No {title.toLowerCase()}
        </p>
      )}
    </section>
  )
}
