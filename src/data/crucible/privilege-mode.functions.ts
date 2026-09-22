import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"
import { writeGlobalPrivilegeMode } from "@/server/crucible/privilege-mode.server"

import { readWorkspaceAccount } from "./account.server"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { privilegeModeSchema } from "./privilege-mode"
import { queryCancellationMiddleware } from "./query-cancellation"

const privilegeModeUpdateSchema = z
  .object({
    mode: privilegeModeSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const updateGlobalPrivilegeMode = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(privilegeModeUpdateSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "private, no-store")
    return safeCrucibleCall(context.correlationId, async () => {
      if (data.mode === "elevated") {
        const account = await readWorkspaceAccount(
          data.scenario,
          context.requestSignal,
          "elevated"
        )
        if (
          !account.authorization.can_elevate ||
          account.authorization.effective_privilege_mode !== "elevated"
        ) {
          throw new Error("Administrator access is unavailable.")
        }
      }

      writeGlobalPrivilegeMode(data.mode)
      return { privilegeMode: data.mode }
    })
  })
