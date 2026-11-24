import { useId } from "react"
import { StatusBadge } from "@/components/crucible/status-badge"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidText } from "@/components/crucible/mfid-text"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceNameLink } from "@/components/crucible/resource-name-link"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import { TableSortControl } from "@/components/crucible/table-sort-control"
import type { TableSortField } from "@/components/crucible/table-sort-control"
import { Button } from "@/components/ui/button"
import { TruncatedText } from "@/components/ui/truncation-tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  WorkspaceAccount,
  WorkspaceDeletionRequest,
  WorkspaceDeletionRequestSort,
} from "@/data/crucible/workspace-source"
import { useEnteringClassName } from "@/hooks/use-entering-keys"
import { cn } from "@/lib/utils"

import { isReviewableDeletionRequest } from "./deletion-bulk-review"

export function DeletionRequestColgroup({
  bulkReview,
  showProject,
  showStatus,
}: {
  bulkReview: boolean
  showProject: boolean
  showStatus: boolean
}) {
  return (
    <colgroup>
      {bulkReview ? <col className="w-column-action" /> : null}
      <col />
      {showProject ? (
        <col className="deletion-request-project-column w-column-secondary" />
      ) : null}
      <col className="deletion-request-requester-column w-column-person" />
      <col className="w-column-date" />
      {showStatus ? <col className="w-column-badge" /> : null}
      <col className="w-column-action-label" />
    </colgroup>
  )
}

function deletionSortFields(
  showProject: boolean,
  showStatus: boolean
): TableSortField<WorkspaceDeletionRequestSort>[] {
  return [
    { field: "resource_name", label: "Resource", preferredDirection: "asc" },
    ...(showProject
      ? [
          {
            field: "project_id",
            label: "Project",
            preferredDirection: "asc",
          } as const,
        ]
      : []),
    {
      field: "requester_name",
      label: "Requested by",
      preferredDirection: "asc",
    },
    { field: "request_time", kind: "date", label: "Requested" },
    ...(showStatus
      ? [
          {
            field: "status",
            label: "Status",
            preferredDirection: "asc",
          } as const,
        ]
      : []),
  ]
}

export function DeletionRequestTableHeader({
  bulkReview,
  bulkReviewActions,
  direction,
  onSelectAll,
  onSortChange,
  selectableCount = 0,
  selectedCount = 0,
  showProject,
  showStatus,
  sort,
}: {
  bulkReview: boolean
  bulkReviewActions?: React.ReactNode
  direction: "asc" | "desc"
  onSelectAll?: (checked: boolean) => void
  onSortChange?: (
    sort: WorkspaceDeletionRequestSort,
    direction: "asc" | "desc"
  ) => void
  selectableCount?: number
  selectedCount?: number
  showProject: boolean
  showStatus: boolean
  sort: WorkspaceDeletionRequestSort
}) {
  return (
    <TableHeader>
      <TableRow>
        {bulkReview ? (
          <TableHead kind="select">
            <Checkbox
              aria-label="Select all loaded reviewable requests"
              className="mx-auto"
              checked={selectableCount > 0 && selectedCount === selectableCount}
              disabled={!onSelectAll || selectableCount === 0}
              indeterminate={
                selectedCount > 0 && selectedCount < selectableCount
              }
              onCheckedChange={(checked) => onSelectAll?.(checked)}
            />
          </TableHead>
        ) : null}
        {bulkReviewActions ? (
          <TableHead colSpan={4 + (showProject ? 1 : 0) + (showStatus ? 1 : 0)}>
            {bulkReviewActions}
          </TableHead>
        ) : onSortChange ? (
          <SortableTableHead
            active={sort === "resource_name"}
            direction={direction}
            field="resource_name"
            label="Resource"
            onChange={onSortChange}
            preferredDirection="asc"
          />
        ) : (
          <TableHead>Resource</TableHead>
        )}
        {!bulkReviewActions && showProject ? (
          onSortChange ? (
            <SortableTableHead
              active={sort === "project_id"}
              className="deletion-request-project"
              direction={direction}
              field="project_id"
              label="Project"
              onChange={onSortChange}
              preferredDirection="asc"
            />
          ) : (
            <TableHead className="deletion-request-project">Project</TableHead>
          )
        ) : null}
        {!bulkReviewActions ? (
          onSortChange ? (
            <SortableTableHead
              active={sort === "requester_name"}
              className="deletion-request-requester"
              direction={direction}
              field="requester_name"
              label="Requested by"
              onChange={onSortChange}
              preferredDirection="asc"
            />
          ) : (
            <TableHead className="deletion-request-requester">
              Requested by
            </TableHead>
          )
        ) : null}
        {!bulkReviewActions ? (
          onSortChange ? (
            <SortableTableHead
              active={sort === "request_time"}
              direction={direction}
              field="request_time"
              label="Requested"
              onChange={onSortChange}
              preferredDirection="desc"
            />
          ) : (
            <TableHead kind="date">Requested</TableHead>
          )
        ) : null}
        {!bulkReviewActions && showStatus ? (
          onSortChange ? (
            <SortableTableHead
              active={sort === "status"}
              direction={direction}
              field="status"
              label="Status"
              onChange={onSortChange}
              preferredDirection="asc"
            />
          ) : (
            <TableHead>Status</TableHead>
          )
        ) : null}
        {!bulkReviewActions ? (
          <TableHead kind="action">
            <span className="sr-only">Actions</span>
          </TableHead>
        ) : null}
      </TableRow>
    </TableHeader>
  )
}

export function DeletionRequestTable({
  account,
  bulkReview,
  bulkReviewActions,
  direction,
  items,
  onSortChange,
  onOpen,
  onSelectionChange,
  selectedRequestIds,
  showProject,
  showStatus,
  sort,
}: {
  account: WorkspaceAccount
  bulkReview: boolean
  bulkReviewActions?: React.ReactNode
  direction: "asc" | "desc"
  items: readonly WorkspaceDeletionRequest[]
  onSortChange?: (
    sort: WorkspaceDeletionRequestSort,
    direction: "asc" | "desc"
  ) => void
  onOpen: (request: WorkspaceDeletionRequest) => void
  onSelectionChange: React.Dispatch<React.SetStateAction<Set<number>>>
  selectedRequestIds: ReadonlySet<number>
  showProject: boolean
  showStatus: boolean
  sort: WorkspaceDeletionRequestSort
}) {
  const mobileSelectAllId = useId()
  const selectableRequests = bulkReview
    ? items.filter(isReviewableDeletionRequest)
    : []
  const selectedCount = selectableRequests.filter((request) =>
    selectedRequestIds.has(request.id)
  ).length

  function selectAll(checked: boolean) {
    onSelectionChange((current) => {
      const next = new Set(current)
      for (const request of selectableRequests) {
        if (checked) next.add(request.id)
        else next.delete(request.id)
      }
      return next
    })
  }

  const enterClassName = useEnteringClassName(
    items.map((item) => String(item.id))
  )
  return (
    <>
      <Table
        aria-label="Deletion requests"
        before={
          <>
            {bulkReview ? (
              <div className="table-card-only min-h-11 items-center gap-2 border-b px-3 py-2">
                <Checkbox
                  aria-label="Select all loaded reviewable requests"
                  checked={
                    selectableRequests.length > 0 &&
                    selectedCount === selectableRequests.length
                  }
                  disabled={selectableRequests.length === 0}
                  id={mobileSelectAllId}
                  indeterminate={
                    selectedCount > 0 &&
                    selectedCount < selectableRequests.length
                  }
                  onCheckedChange={selectAll}
                />
                {bulkReviewActions ?? (
                  <label
                    className="cursor-pointer text-label"
                    htmlFor={mobileSelectAllId}
                  >
                    Select all loaded
                  </label>
                )}
              </div>
            ) : null}
            {onSortChange && !bulkReviewActions ? (
              <TableSortControl
                direction={direction}
                fields={deletionSortFields(showProject, showStatus)}
                onChange={onSortChange}
                sort={sort}
              />
            ) : null}
          </>
        }
        className={cn(
          "deletion-request-table table-fixed",
          bulkReview && "has-selection",
          showProject && "has-project"
        )}
      >
        <DeletionRequestColgroup
          bulkReview={bulkReview}
          showProject={showProject}
          showStatus={showStatus}
        />
        <DeletionRequestTableHeader
          bulkReviewActions={bulkReviewActions}
          bulkReview={bulkReview}
          direction={direction}
          onSelectAll={selectAll}
          onSortChange={onSortChange}
          selectedCount={selectedCount}
          selectableCount={selectableRequests.length}
          showProject={showProject}
          showStatus={showStatus}
          sort={sort}
        />
        <TableBody>
          {items.map((request) => {
            const requester =
              request.requester_id === account.unique_id
                ? account
                : request.requester
            return (
              <TableRow
                className={enterClassName(String(request.id))}
                data-state={
                  selectedRequestIds.has(request.id) ? "selected" : undefined
                }
                key={request.id}
              >
                {bulkReview ? (
                  <TableCell kind="select" className="deletion-request-select">
                    <Checkbox
                      aria-label={`Select deletion request for ${request.resource_name?.trim() || "untitled resource"}`}
                      checked={selectedRequestIds.has(request.id)}
                      className="mx-auto"
                      disabled={!isReviewableDeletionRequest(request)}
                      onCheckedChange={(checked) => {
                        onSelectionChange((current) => {
                          const next = new Set(current)
                          if (checked) next.add(request.id)
                          else next.delete(request.id)
                          return next
                        })
                      }}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="deletion-request-resource">
                  <DeletionRequestResource request={request} />
                </TableCell>
                {showProject ? (
                  <TableCell
                    className="deletion-request-project"
                    data-label="Project"
                  >
                    <DeletionRequestProject request={request} />
                  </TableCell>
                ) : null}
                <TableCell
                  className="deletion-request-requester"
                  data-label="Requested by"
                >
                  {requester ? (
                    <PersonLink
                      nameStyle="abbreviated"
                      person={requester}
                      presentation="collection"
                    />
                  ) : (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <PrincipalTypeIcon type="user" />
                      <MfidText
                        className="truncate"
                        presentation="supporting"
                        value={request.requester_id}
                      />
                    </span>
                  )}
                </TableCell>
                <TableCell
                  kind="date"
                  className="deletion-request-date"
                  data-label="Requested"
                >
                  <LocalDateTime value={request.request_time} />
                </TableCell>
                {showStatus ? (
                  <TableCell
                    className="deletion-request-status"
                    data-label="Status"
                  >
                    <StatusBadge
                      domain="deletion-request"
                      status={request.status}
                    />
                  </TableCell>
                ) : null}
                <TableCell kind="action" className="deletion-request-action">
                  <Button
                    onClick={() => onOpen(request)}
                    size="sm"
                    variant={
                      request.capabilities.can_review ? "outline" : "ghost"
                    }
                  >
                    {request.capabilities.can_review ? "Review" : "View"}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </>
  )
}

function DeletionRequestResource({
  request,
}: {
  request: WorkspaceDeletionRequest
}) {
  const kind = resourceKind(request.resource_type)
  const name = request.resource_name?.trim() || "Untitled resource"
  return (
    <ResourceIdentity
      kind={kind}
      name={name}
      nameContent={
        <ResourceNameLink
          kind={kind}
          mfid={request.resource_mfid}
          name={name}
          navigation="preview"
        />
      }
      presentation="collection"
    />
  )
}

function DeletionRequestProject({
  request,
}: {
  request: WorkspaceDeletionRequest
}) {
  const projectId = request.project_id?.trim()
  if (!projectId)
    return <span className="text-muted-foreground">Not assigned</span>
  if (!request.project_mfid)
    return <TruncatedText className="block truncate">{projectId}</TruncatedText>
  return (
    <ResourceIdentityLink
      className="block min-w-0"
      kind="project"
      mfid={request.project_mfid}
      name={projectId}
      showTypeIcon={false}
    >
      <TruncatedText className="block truncate hover:underline">
        {projectId}
      </TruncatedText>
    </ResourceIdentityLink>
  )
}

export function resourceKind(type: string | null | undefined) {
  if (type === "sample" || type === "project" || type === "instrument")
    return type
  return "dataset"
}
