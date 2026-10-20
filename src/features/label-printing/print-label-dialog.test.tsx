import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getWorkspacePrinters,
  printWorkspaceResourceLabel,
} from "@/data/crucible/print.functions"
import { identityScope } from "@/data/crucible/query-keys"

import { PrintLabelButton } from "./print-label-dialog"

const update = vi.fn()

vi.mock("@/data/crucible/print.functions", () => ({
  getWorkspacePrinters: vi.fn(),
  printWorkspaceResourceLabel: vi.fn(),
}))

vi.mock("@/components/crucible/workspace-provider", () => ({
  useWorkspaceScope: () =>
    identityScope("crucible-fixture:populated", "account"),
}))

vi.mock("@/features/preferences/use-account-preferences", () => ({
  useAccountPreferences: () => ({
    preferences: { hub: { label_printer: "spinbot" } },
    update,
  }),
}))

const printers = [
  { online: true, printer_id: "bench-lab", ts: 1 },
  { online: false, printer_id: "glovebox", ts: 1 },
  { online: true, printer_id: "spinbot", ts: 1 },
]

function renderButton() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PrintLabelButton mfid="01J6Y8N4Q2R7M9K3T5V0W1X2Z9" name="Catalyst map" />
    </QueryClientProvider>
  )
  fireEvent.click(screen.getByRole("button", { name: "Print label" }))
}

function printResult(status: "ok" | "error" | "timeout", detail?: string) {
  return {
    data: {
      detail: detail ?? null,
      job_id: "job-1",
      mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
      name: "Catalyst map",
      printer_id: "spinbot",
      status,
      ts: 1,
    },
    status: "ok",
  } as never
}

describe("PrintLabelButton", () => {
  afterEach(cleanup)

  beforeEach(() => {
    update.mockReset()
    vi.mocked(getWorkspacePrinters).mockResolvedValue({
      data: printers,
      status: "ok",
    } as never)
    vi.mocked(printWorkspaceResourceLabel).mockReset()
  })

  it("prefills the label and picks the remembered online printer", async () => {
    renderButton()

    expect(screen.getByLabelText<HTMLInputElement>("Label name").value).toBe(
      "Catalyst map"
    )
    const printer = screen.getByLabelText<HTMLSelectElement>("Printer")
    await waitFor(() => expect(printer.value).toBe("spinbot"))
    expect(
      screen.getByRole<HTMLOptionElement>("option", {
        name: "glovebox (offline)",
      }).disabled
    ).toBe(true)
  })

  it("prints the open resource and remembers the printer", async () => {
    vi.mocked(printWorkspaceResourceLabel).mockResolvedValue(printResult("ok"))
    renderButton()
    const printer = screen.getByLabelText<HTMLSelectElement>("Printer")
    await waitFor(() => expect(printer.value).toBe("spinbot"))
    fireEvent.change(printer, { target: { value: "bench-lab" } })

    fireEvent.click(screen.getByRole("button", { name: "Print" }))

    await waitFor(() =>
      expect(printWorkspaceResourceLabel).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
            name: "Catalyst map",
            printerId: "bench-lab",
          }),
        })
      )
    )
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        hub: { label_printer: "bench-lab" },
      })
    )
  })

  it("explains a printer that does not answer", async () => {
    vi.mocked(printWorkspaceResourceLabel).mockResolvedValue(
      printResult("timeout", "Requested printer not currently online.")
    )
    renderButton()
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>("Printer").value).toBe(
        "spinbot"
      )
    )

    fireEvent.click(screen.getByRole("button", { name: "Print" }))

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The printer did not respond. Requested printer not currently online."
    )
    expect(update).not.toHaveBeenCalled()
  })
})
