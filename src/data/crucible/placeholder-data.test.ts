import { describe, expect, it } from "vitest"

import { identityScope } from "./query-keys"
import {
  metadataSearchQueryOptions,
  searchQueryOptions,
} from "./search.queries"

type Placeholder = (
  previousData: unknown,
  previousQuery: { queryKey: readonly unknown[] } | undefined
) => unknown

const scope = identityScope("hosted", "account-a")
const page = { items: ["previous"] }

describe("search placeholder data", () => {
  const records = (query: string) =>
    searchQueryOptions(scope, query, ["sample", "dataset"])
  const metadata = (query: string) => metadataSearchQueryOptions(scope, query)

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
