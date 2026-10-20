import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { identityScope } from "@/data/crucible/query-keys"
import { updateWorkspaceResourceMetadata } from "@/data/crucible/resources.functions"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"

import { draftFromMetadata } from "./metadata-input"
import { ScientificMetadataForm } from "./scientific-metadata-form"

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useBlocker: () => ({ status: "idle" }),
}))

vi.mock("@/data/crucible/resources.functions", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  updateWorkspaceResourceMetadata: vi.fn(),
}))

afterEach(cleanup)

const scope = identityScope("crucible-fixture:populated", "account")

function sample(
  scientificMetadata: Record<string, unknown>
): Extract<WorkspaceResourceDetail, { kind: "sample" }> {
  return {
    capabilities: null,
    creation_time: null,
    description: null,
    kind: "sample",
    links: [],
    modification_time: null,
    name: "Metadata sample",
    owner: null,
    project: null,
    project_id: null,
    public: false,
    sample_type: null,
    scientific_metadata: scientificMetadata as never,
    timestamp: null,
    unique_id: "sample-mfid",
  }
}

function renderForm(resource: ReturnType<typeof sample>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ScientificMetadataForm
        mode="fixture"
        onCancel={() => {}}
        onSaved={() => {}}
        resource={resource}
        scope={scope}
      />
    </QueryClientProvider>
  )
}

function saved(metadata: Record<string, unknown>) {
  return { data: { scientific_metadata: metadata }, status: "ok" } as never
}

describe("metadata drafts", () => {
  it("opens flat metadata as fields and other metadata as JSON", () => {
    expect(draftFromMetadata({ pressure: 2, phase: "solid" }).mode).toBe(
      "fields"
    )
    expect(draftFromMetadata({ scans: [1, 2] }).mode).toBe("json")
    expect(draftFromMetadata({ code: "007" }).mode).toBe("fields")
    expect(draftFromMetadata({ code: "42" }).mode).toBe("json")
    const many = Object.fromEntries(
      Array.from({ length: 31 }, (_, index) => [`field_${index}`, index])
    )
    expect(draftFromMetadata(many).mode).toBe("json")
  })
})

describe("scientific metadata editing", () => {
  it("saves only the changed field from fields mode", async () => {
    vi.mocked(updateWorkspaceResourceMetadata).mockResolvedValue(
      saved({ phase: "solid", pressure: 3 })
    )
    renderForm(sample({ phase: "solid", pressure: 2 }))

    fireEvent.change(screen.getByLabelText("Field 2 value"), {
      target: { value: "3" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Save scientific metadata" })
    )

    await waitFor(() =>
      expect(updateWorkspaceResourceMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            update: { kind: "merge", metadata: { pressure: 3 } },
          }),
        })
      )
    )
  })

  it("asks before replacing everything when a field is removed", async () => {
    vi.mocked(updateWorkspaceResourceMetadata).mockReset()
    renderForm(sample({ phase: "solid", pressure: 2 }))

    fireEvent.click(screen.getByRole("button", { name: "Remove field 1" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Save scientific metadata" })
    )

    expect(
      await screen.findByRole("alertdialog", {
        name: "Replace scientific metadata?",
      })
    ).toBeTruthy()
    expect(updateWorkspaceResourceMetadata).not.toHaveBeenCalled()
  })

  it("asks whether an uploaded file merges with or replaces the metadata", async () => {
    renderForm(sample({ phase: "solid", pressure: 2 }))
    const file = new File(['{"pressure": 5, "gas": "argon"}'], "run.json", {
      type: "application/json",
    })

    fireEvent.change(
      document.querySelector<HTMLInputElement>('input[type="file"]')!,
      { target: { files: [file] } }
    )
    const dialog = await screen.findByRole("alertdialog", {
      name: "Use the uploaded metadata?",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Merge" }))

    await waitFor(() =>
      expect(
        screen
          .getAllByRole("textbox")
          .map((input) => (input as HTMLInputElement).value)
      ).toEqual(["phase", "solid", "pressure", "5", "gas", "argon"])
    )
  })
})
