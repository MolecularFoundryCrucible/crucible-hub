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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

const rowPlaceholders = ["first", "second", "third", "fourth"] as const

export function CollectionTablePending({ label }: { label: string }) {
  return (
    <Card aria-label={`Loading ${label}`} role="status">
      <CardContent className="flex flex-col gap-4 py-4">
        {rowPlaceholders.map((placeholder) => (
          <div className="flex gap-4" key={placeholder}>
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-5 w-1/5" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function CollectionRowsPending({ label }: { label: string }) {
  return (
    <div
      aria-label={`Loading ${label}`}
      className="flex flex-col gap-3"
      role="status"
    >
      {rowPlaceholders.slice(0, 3).map((placeholder) => (
        <div className="flex flex-col gap-2" key={placeholder}>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
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
    <p className="text-supporting text-muted-foreground" role="status">
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
  description,
  retry,
  role,
  title,
}: {
  description?: string
  retry?: () => void
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
          Try again
        </Button>
      ) : null}
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
