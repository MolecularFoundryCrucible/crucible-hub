import "@tanstack/react-start/server-only"

import type { components } from "@/generated/crucible-api"
import { createCrucibleClient } from "@/server/crucible/client.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"

import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"

export type WorkspacePrinter = components["schemas"]["PrinterStatus"]
export type WorkspaceLabelPrint = components["schemas"]["BarcodePrintResponse"]

function fixturePrinters(): WorkspacePrinter[] {
  const now = Date.now() / 1000
  return [
    { online: true, printer_id: "bench-lab", ts: now },
    { online: false, printer_id: "glovebox", ts: now - 3600 },
    { online: true, printer_id: "spinbot", ts: now },
  ]
}

export async function readWorkspacePrinters(
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspacePrinter[]> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") return fixturePrinters()

  const result = await createCrucibleClient(configuration).GET(
    "/print/printers",
    { signal: crucibleRequestSignal(requestSignal) }
  )
  if (!result.data) throw new CrucibleResponseError(result.response)
  return result.data.printers
}

export async function printWorkspaceLabel(
  label: { mfid: string; name: string; printerId: string },
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceLabelPrint> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const printer = fixturePrinters().find(
      (candidate) => candidate.printer_id === label.printerId
    )
    return {
      detail: printer?.online
        ? null
        : "Requested printer not currently online. Check spelling and the crucible-printer dashboard.",
      job_id: crypto.randomUUID(),
      mfid: label.mfid,
      name: label.name,
      printer_id: label.printerId,
      status: printer?.online ? "ok" : "timeout",
      ts: Date.now() / 1000,
    }
  }

  const result = await createCrucibleClient(configuration).POST(
    "/print/barcode",
    {
      body: {
        mfid: label.mfid,
        name: label.name,
        printer_id: label.printerId,
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response)
  return result.data
}
