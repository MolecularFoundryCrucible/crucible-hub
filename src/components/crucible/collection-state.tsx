import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  ResourceList,
  ResourceListItem,
  ResourceListItemContent,
} from "@/components/crucible/resource-list"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TableColumnKind } from "@/components/ui/table"

const rowPlaceholders = ["first", "second", "third", "fourth"] as const

type CollectionTablePendingPresentation =
  | "instruments"
  | "projects"
  | "resources"
  | "resources-scoped"
  | "service-accounts"
  | "user-projects"
  | "users"

type PendingColumn = {
  className?: string
  columnClassName?: string
  kind?: TableColumnKind
  label: string
  name?: boolean
}

const pendingColumns: Record<
  CollectionTablePendingPresentation,
  readonly PendingColumn[]
> = {
  instruments: [
    {
      className: "resource-directory-name",
      columnClassName: "resource-directory-name-column",
      label: "Instrument",
      name: true,
    },
    {
      className: "resource-directory-location",
      columnClassName: "resource-directory-location-column w-column-secondary",
      label: "Location",
    },
    {
      className: "resource-directory-person",
      columnClassName: "resource-directory-person-column",
      label: "Manager",
    },
    {
      className: "resource-directory-date hidden @directory-wide:table-cell",
      columnClassName:
        "resource-directory-date-column hidden @directory-wide:table-column",
      label: "Created",
      kind: "date",
    },
    {
      className: "resource-directory-date",
      columnClassName: "resource-directory-date-column",
      label: "Last activity",
      kind: "date",
    },
    {
      className: "resource-directory-action",
      columnClassName: "resource-directory-action-column",
      label: "Open",
      kind: "action",
    },
  ],
  projects: [
    {
      className: "resource-directory-name",
      columnClassName: "resource-directory-name-column",
      label: "Project",
      name: true,
    },
    {
      className: "resource-directory-person",
      columnClassName: "resource-directory-person-column",
      label: "Lead",
    },
    {
      className: "resource-directory-role hidden @directory-wide:table-cell",
      columnClassName:
        "resource-directory-role-column hidden @directory-wide:table-column",
      label: "Role",
    },
    {
      className: "resource-directory-date hidden @directory-wide:table-cell",
      columnClassName:
        "resource-directory-date-column hidden @directory-wide:table-column",
      label: "Created",
      kind: "date",
    },
    {
      className: "resource-directory-date",
      columnClassName: "resource-directory-date-column",
      label: "Last activity",
      kind: "date",
    },
    {
      className: "resource-directory-action",
      columnClassName: "resource-directory-action-column",
      label: "Open",
      kind: "action",
    },
  ],
  resources: [
    {
      className: "resource-collection-name",
      label: "Name",
      name: true,
    },
    {
      className: "resource-collection-type hidden @collection-wide:table-cell",
      columnClassName: "hidden @collection-wide:table-column w-column-label",
      label: "Type",
    },
    {
      className: "resource-collection-project",
      columnClassName: "resource-collection-project-column w-column-secondary",
      label: "Project",
    },
    {
      className: "resource-collection-owner",
      columnClassName: "resource-collection-owner-column w-column-person",
      label: "Owner",
    },
    {
      className: "resource-collection-date hidden @collection-wide:table-cell",
      columnClassName: "hidden w-column-date @collection-wide:table-column",
      label: "Created",
      kind: "date",
    },
    {
      className: "resource-collection-date",
      columnClassName: "w-column-date",
      label: "Updated",
      kind: "date",
    },
    {
      className: "resource-collection-action",
      columnClassName: "w-column-action",
      label: "Open",
      kind: "action",
    },
  ],
  "resources-scoped": [
    {
      className: "resource-collection-name",
      label: "Name",
      name: true,
    },
    {
      className: "resource-collection-type hidden @collection-wide:table-cell",
      columnClassName: "hidden @collection-wide:table-column w-column-label",
      label: "Type",
    },
    {
      className: "resource-collection-owner",
      columnClassName: "resource-collection-owner-column w-column-person",
      label: "Owner",
    },
    {
      className: "resource-collection-date hidden @collection-wide:table-cell",
      columnClassName: "hidden w-column-date @collection-wide:table-column",
      label: "Created",
      kind: "date",
    },
    {
      className: "resource-collection-date",
      columnClassName: "w-column-date",
      label: "Updated",
      kind: "date",
    },
    {
      className: "resource-collection-action",
      columnClassName: "w-column-action",
      label: "Open",
      kind: "action",
    },
  ],
  "service-accounts": [
    {
      className: "identity-directory-account",
      columnClassName: "identity-directory-account-column",
      label: "Account",
      name: true,
    },
    {
      className: "identity-directory-mfid",
      columnClassName: "identity-directory-mfid-column w-column-secondary",
      label: "Crucible ID",
    },
    {
      className: "identity-directory-role",
      columnClassName: "identity-directory-role-column",
      label: "Platform role",
    },
    {
      className: "identity-directory-activity",
      columnClassName: "identity-directory-activity-column",
      kind: "date",
      label: "Last active",
    },
    {
      className: "identity-directory-action",
      columnClassName: "identity-directory-action-column",
      kind: "action",
      label: "Open",
    },
  ],
  "user-projects": [
    {
      className: "resource-directory-name",
      columnClassName: "resource-directory-name-column",
      label: "Project",
      name: true,
    },
    {
      className: "resource-directory-person",
      columnClassName: "resource-directory-person-column",
      label: "Lead",
    },
    {
      className: "resource-directory-role hidden @directory-wide:table-cell",
      columnClassName:
        "resource-directory-role-column hidden @directory-wide:table-column",
      label: "Role",
    },
    {
      className: "resource-directory-date hidden @directory-wide:table-cell",
      columnClassName:
        "resource-directory-date-column hidden @directory-wide:table-column",
      label: "Created",
      kind: "date",
    },
    {
      className: "resource-directory-date",
      columnClassName: "resource-directory-date-column",
      label: "Updated",
      kind: "date",
    },
    {
      className: "resource-directory-action",
      columnClassName: "resource-directory-action-column",
      label: "Open",
      kind: "action",
    },
  ],
  users: [
    {
      className: "identity-directory-account",
      columnClassName: "identity-directory-account-column",
      label: "Account",
      name: true,
    },
    {
      className: "identity-directory-mfid identity-directory-optional",
      columnClassName:
        "identity-directory-mfid-column identity-directory-optional w-column-id @identity-wide:w-column-id-wide",
      label: "Crucible ID",
    },
    {
      className: "identity-directory-email",
      columnClassName: "identity-directory-email-column w-column-secondary",
      label: "Email",
    },
    {
      className: "identity-directory-role",
      columnClassName: "identity-directory-role-column",
      label: "Platform role",
    },
    {
      className: "identity-directory-activity",
      columnClassName: "identity-directory-activity-column",
      kind: "date",
      label: "Last active",
    },
    {
      className: "identity-directory-action",
      columnClassName: "identity-directory-action-column",
      kind: "action",
      label: "Open",
    },
  ],
}

export function CollectionTablePending({
  framed = true,
  label,
  presentation = "resources",
  subtypeLabel,
}: {
  framed?: boolean
  label: string
  presentation?: CollectionTablePendingPresentation
  subtypeLabel?: string
}) {
  const columns = pendingColumns[presentation].map((column) =>
    column.label === "Type" && subtypeLabel
      ? { ...column, label: subtypeLabel }
      : column
  )
  const tableClassName =
    presentation === "service-accounts" || presentation === "users"
      ? "identity-directory-table table-fixed"
      : presentation === "projects" || presentation === "user-projects"
        ? "resource-directory-table resource-directory-project-table table-fixed"
        : presentation === "instruments"
          ? "resource-directory-table resource-directory-instrument-table table-fixed"
          : "resource-collection-table table-fixed"
  const table = (
    <Table className={tableClassName}>
      <colgroup>
        {columns.map((column) => (
          <col className={column.columnClassName} key={column.label} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              className={column.className}
              key={column.label}
              kind={column.kind}
            >
              {column.label === "Open" ? (
                <span className="sr-only">Open</span>
              ) : (
                column.label
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rowPlaceholders.map((placeholder) => (
          <TableRow key={placeholder}>
            {columns.map((column) => (
              <TableCell
                className={column.className}
                data-label={column.label}
                key={column.label}
                kind={column.kind}
              >
                {column.name ? (
                  <div className="flex min-w-0 items-start gap-2">
                    <Skeleton className="mt-0.5 size-4 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ) : column.label === "Open" ? (
                  <Skeleton className="ml-auto size-7" />
                ) : (
                  <Skeleton className="h-4 w-3/4" />
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
  if (!framed) {
    return (
      <div aria-busy="true" aria-label={`Loading ${label}`} role="status">
        {table}
      </div>
    )
  }
  return (
    <Card aria-busy="true" aria-label={`Loading ${label}`} role="status">
      <CardContent className="px-0">{table}</CardContent>
    </Card>
  )
}

export function ResourceListPending({
  label,
  rows = 3,
  trailing = true,
}: {
  label: string
  rows?: number
  trailing?: boolean
}) {
  return (
    <>
      <span className="sr-only" role="status">
        Loading {label}
      </span>
      <ResourceList aria-busy="true" aria-label={`Loading ${label}`}>
        {Array.from({ length: rows }, (_, index) => (
          <ResourceListItem key={index}>
            <ResourceListItemContent layout="responsive">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Skeleton className="mt-0.5 size-4 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
              {trailing ? (
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ) : null}
            </ResourceListItemContent>
          </ResourceListItem>
        ))}
      </ResourceList>
    </>
  )
}

export function CollectionLoadError({
  label,
  retry,
}: {
  label: string
  retry: () => void
}) {
  return (
    <Empty className="min-h-state border">
      <EmptyHeader>
        <EmptyTitle>{label} could not be loaded</EmptyTitle>
        <EmptyDescription>
          Try again. Other workspace navigation remains available.
        </EmptyDescription>
        <Button onClick={retry} variant="outline">
          Try again
        </Button>
      </EmptyHeader>
    </Empty>
  )
}

export function CollectionUpdateStatus({
  label,
  updating,
}: {
  label: string
  updating: boolean
}) {
  if (!updating) return null

  return (
    <p className="sr-only" role="status">
      Updating {label}…
    </p>
  )
}

export function CollectionUpdateError({
  label,
  preserved,
  retry,
}: {
  label: string
  preserved: boolean
  retry: () => void
}) {
  return (
    <Card role="alert" size="sm">
      <CardHeader>
        <CardTitle>
          {label} could not be {preserved ? "refreshed" : "loaded"}
        </CardTitle>
        <CardDescription>
          {preserved
            ? "Previously loaded data remains available."
            : "Other data remains available."}
        </CardDescription>
        <CardAction>
          <Button onClick={retry} size="sm" variant="outline">
            Try again
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  )
}

export function PanelState({
  action,
  children,
  description,
  retry,
  retryLabel = "Try again",
  role,
  title,
}: {
  action?: ReactNode
  children?: ReactNode
  description?: string
  retry?: () => void
  retryLabel?: string
  role?: "alert" | "status"
  title: string
}) {
  return (
    <Empty role={role}>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {retry ? (
        <Button onClick={retry} size="sm" variant="outline">
          {retryLabel}
        </Button>
      ) : null}
      {action ? <EmptyContent>{action}</EmptyContent> : null}
      {children}
    </Empty>
  )
}

export function PanelUpdateError({
  description,
  retry,
}: {
  description: string
  retry?: () => void
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3"
      role="alert"
    >
      <p className="text-body text-muted-foreground">{description}</p>
      {retry ? (
        <Button onClick={retry} size="sm" variant="outline">
          Try again
        </Button>
      ) : null}
    </div>
  )
}
