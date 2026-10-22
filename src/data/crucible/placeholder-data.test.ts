import { describe, expect, it } from "vitest"

import {
  datasetsCursorQueryOptions,
  samplesCursorQueryOptions,
} from "./data.queries"
import { instrumentsQueryOptions } from "./instruments.queries"
import { projectsQueryOptions } from "./projects.queries"
import { identityScope } from "./query-keys"
import { serviceAccountsCursorQueryOptions } from "./service-accounts.queries"
import { usersCursorQueryOptions } from "./users.queries"

type Placeholder = (
  previousData: unknown,
  previousQuery: { queryKey: readonly unknown[] } | undefined
) => unknown

const scope = identityScope("hosted", "account-a")
const otherAccount = identityScope("hosted", "account-b")
const page = { items: ["previous"] }

const collections = [
  {
    label: "samples",
    options: (s: typeof scope, sort?: "created" | "name") =>
      samplesCursorQueryOptions(s, { limit: 50, sort }),
  },
  {
    label: "datasets",
    options: (s: typeof scope, sort?: "created" | "name") =>
      datasetsCursorQueryOptions(s, { limit: 50, sort }),
  },
  {
    label: "projects",
    options: (s: typeof scope, sort?: "created" | "name") =>
      projectsQueryOptions(s, {
        limit: 50,
        sort: sort === "name" ? "title" : sort,
      }),
  },
  {
    label: "users",
    options: (s: typeof scope, sort?: "created" | "name") =>
      usersCursorQueryOptions(s, {
        limit: 50,
        sort: sort === "created" ? "last_active" : sort,
      }),
  },
  {
    label: "service accounts",
    options: (s: typeof scope, sort?: "created" | "name") =>
      serviceAccountsCursorQueryOptions(s, {
        limit: 50,
        sort: sort === "created" ? "last_active" : "username",
      }),
  },
  {
    label: "instruments",
    options: (s: typeof scope, sort?: "created" | "name") =>
      instrumentsQueryOptions(s, { limit: 50, sort }),
  },
]

describe.each(collections)("$label placeholder data", ({ options }) => {
  const placeholder = options(scope, "name").placeholderData as Placeholder

  it("keeps the previous results while a changed filter or sort loads", () => {
    expect(
      placeholder(page, { queryKey: options(scope, "created").queryKey })
    ).toBe(page)
  })

  it("never keeps results from another account", () => {
    expect(
      placeholder(page, { queryKey: options(otherAccount, "name").queryKey })
    ).toBeUndefined()
  })
})
