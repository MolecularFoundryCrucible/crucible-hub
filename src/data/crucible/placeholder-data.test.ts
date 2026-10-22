import { describe, expect, it } from "vitest"

import {
  datasetsCursorQueryOptions,
  samplesCursorQueryOptions,
} from "./data.queries"
import { deletionAuditInfiniteQueryOptions } from "./deletion-requests.queries"
import { datasetFacetQueryOptions } from "./facets.queries"
import { instrumentsQueryOptions } from "./instruments.queries"
import { projectsQueryOptions } from "./projects.queries"
import { identityScope } from "./query-keys"
import {
  metadataSearchQueryOptions,
  searchQueryOptions,
} from "./search.queries"
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

describe("search placeholder data", () => {
  const records = (query: string) =>
    searchQueryOptions(scope, query, ["sample", "dataset"])
  const metadata = (query: string) => metadataSearchQueryOptions(scope, query)

  it("keeps the previous results of the same search mode", () => {
    const placeholder = records("nickel").placeholderData as Placeholder
    expect(placeholder(page, { queryKey: records("nick").queryKey })).toBe(page)
    const metadataPlaceholder = metadata("nickel")
      .placeholderData as Placeholder
    expect(
      metadataPlaceholder(page, { queryKey: metadata("nick").queryKey })
    ).toBe(page)
  })

  it("never shows record results as metadata results or the reverse", () => {
    const placeholder = records("nickel").placeholderData as Placeholder
    expect(
      placeholder(page, { queryKey: metadata("nickel").queryKey })
    ).toBeUndefined()
    const metadataPlaceholder = metadata("nickel")
      .placeholderData as Placeholder
    expect(
      metadataPlaceholder(page, { queryKey: records("nickel").queryKey })
    ).toBeUndefined()
  })
})

describe("facet placeholder data", () => {
  const facets = (field: "measurement" | "owner", sort: "count" | "label") =>
    datasetFacetQueryOptions(
      scope,
      field,
      {},
      {
        ordering: { direction: "asc", sort },
      }
    )

  it("keeps groups of the same field while the order changes", () => {
    const placeholder = facets("measurement", "count")
      .placeholderData as Placeholder
    expect(
      placeholder(page, { queryKey: facets("measurement", "label").queryKey })
    ).toBe(page)
  })

  it("never shows another field's groups", () => {
    const placeholder = facets("measurement", "count")
      .placeholderData as Placeholder
    expect(
      placeholder(page, { queryKey: facets("owner", "count").queryKey })
    ).toBeUndefined()
  })
})

describe("deletion audit placeholder data", () => {
  it("keeps the previous results within the account", () => {
    const placeholder = deletionAuditInfiniteQueryOptions(scope, "all")
      .placeholderData as Placeholder
    expect(
      placeholder(page, {
        queryKey: deletionAuditInfiniteQueryOptions(scope, "submitted")
          .queryKey,
      })
    ).toBe(page)
    expect(
      placeholder(page, {
        queryKey: deletionAuditInfiniteQueryOptions(otherAccount, "submitted")
          .queryKey,
      })
    ).toBeUndefined()
  })
})
