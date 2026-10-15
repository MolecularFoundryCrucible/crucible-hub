import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { WorkspaceFacetBucket } from "@/data/crucible/facets"
import { sampleFacetQueryOptions } from "@/data/crucible/facets.queries"
import { identityScope } from "@/data/crucible/query-keys"

import { buildFacetComboboxState, FacetCombobox } from "./facet-combobox"

afterEach(() => {
  cleanup()
})

const scope = identityScope(
  "https://crucible.example/api/v1",
  "fixture:researcher"
)

const sampleBuckets: readonly WorkspaceFacetBucket[] = [
  { count: 8, label: null, value: "catalyst" },
  { count: 4, label: null, value: "thin film" },
  { count: 2, label: null, value: null },
]

describe("buildFacetComboboxState", () => {
  it("lists all non-empty existing facet buckets when the input is blank", () => {
    expect(buildFacetComboboxState(sampleBuckets, "")).toEqual({
      items: [
        { count: 8, kind: "existing", value: "catalyst" },
        { count: 4, kind: "existing", value: "thin film" },
      ],
      selectedItem: null,
    })
  })

  it("keeps all existing options visible on initial open when the current value matches an existing facet", () => {
    expect(
      buildFacetComboboxState(sampleBuckets, "catalyst", {
        filterByValue: false,
      })
    ).toEqual({
      items: [
        { count: 8, kind: "existing", value: "catalyst" },
        { count: 4, kind: "existing", value: "thin film" },
      ],
      selectedItem: { count: 8, kind: "existing", value: "catalyst" },
    })
  })

  it("filters matching existing facets and appends a create item for novel input", () => {
    expect(
      buildFacetComboboxState(sampleBuckets, "  cat ", {
        filterByValue: true,
      })
    ).toEqual({
      items: [
        { count: 8, kind: "existing", value: "catalyst" },
        { kind: "create", value: "cat" },
      ],
      selectedItem: null,
    })
  })

  it("omits the create item when an exact case-insensitive match already exists", () => {
    expect(
      buildFacetComboboxState(sampleBuckets, "Thin Film", {
        filterByValue: true,
      })
    ).toEqual({
      items: [{ count: 4, kind: "existing", value: "thin film" }],
      selectedItem: { count: 4, kind: "existing", value: "thin film" },
    })
  })
})

function ControlledSampleFacetCombobox({
  initialValue = "",
  projectMfid = "proj-1",
}: {
  initialValue?: string
  projectMfid?: string | undefined
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <div>
      <label htmlFor="sample_type">Sample type</label>
      <FacetCombobox
        field="sample_type"
        id="sample_type"
        kind="sample"
        label="Sample type"
        onChange={setValue}
        projectMfid={projectMfid}
        scope={scope}
        value={value}
      />
      <output data-testid="committed-value">{value}</output>
    </div>
  )
}

function createSeededQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  })
  const options = sampleFacetQueryOptions(
    scope,
    "sample_type",
    { projectMfid: "proj-1", projectScope: "all" },
    { ordering: { direction: "desc", sort: "count" } }
  )
  queryClient.setQueryData(options.queryKey, {
    pageParams: [undefined],
    pages: [
      {
        field: "sample_type",
        items: sampleBuckets,
        limit: 20,
        nextCursor: null,
      },
    ],
  })
  return queryClient
}

describe("FacetCombobox", () => {
  it("opens existing facet options on click and commits a selected option", () => {
    const queryClient = createSeededQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ControlledSampleFacetCombobox />
      </QueryClientProvider>
    )

    const input = screen.getByRole("combobox", { name: "Sample type" })
    fireEvent.click(input)

    const option = screen.getByRole("option", { name: /thin film/i })
    fireEvent.click(option)

    expect(screen.getByTestId("committed-value").textContent).toBe("thin film")
    expect((input as HTMLInputElement).value).toBe("thin film")
  })

  it("suggests creating a novel value while typing and preserves it on blur/tab", () => {
    const queryClient = createSeededQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ControlledSampleFacetCombobox />
      </QueryClientProvider>
    )

    const input = screen.getByRole("combobox", { name: "Sample type" })
    fireEvent.change(input, { target: { value: "  perovskite  " } })

    expect(
      screen.getByRole("option", { name: /Create .perovskite./i })
    ).toBeTruthy()

    fireEvent.blur(input)

    expect(screen.getByTestId("committed-value").textContent).toBe("perovskite")
    expect((input as HTMLInputElement).value).toBe("perovskite")
  })
})
