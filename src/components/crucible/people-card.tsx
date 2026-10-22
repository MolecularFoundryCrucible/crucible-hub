import type { ReactNode } from "react"

import { MembersIcon } from "@/components/crucible/icons"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type PeopleCardEntry = {
  key: string
  person: ReactNode
  role: ReactNode
}

/**
 * The People card shared by project and instrument Overview pages. `entries`
 * is null when the API does not show membership to this person.
 */
export function PeopleCard({
  action,
  entries,
  error,
  pending = false,
}: {
  action?: ReactNode
  entries: readonly PeopleCardEntry[] | null | undefined
  error?: ReactNode
  pending?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>People</CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>
        {pending ? (
          <div aria-busy="true" className="grid gap-3">
            <span className="sr-only" role="status">
              Loading people
            </span>
            {Array.from({ length: 3 }, (_, index) => (
              <div className="flex items-center gap-3" key={index}>
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          error
        ) : entries ? (
          entries.length ? (
            <ul className="grid gap-3">
              {entries.map((entry) => (
                <li className="flex min-w-0 items-center gap-3" key={entry.key}>
                  {entry.person}
                  {entry.role}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-muted-foreground">
              No members are currently listed.
            </p>
          )
        ) : (
          <div className="flex items-center gap-2 text-body text-muted-foreground">
            <MembersIcon aria-hidden="true" />
            Detailed membership is not available.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
