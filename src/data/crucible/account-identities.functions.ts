import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import {
  cancelHubLink,
  confirmHubLink,
  previewHubLink,
} from "@/server/crucible/hub-link.server"
import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  readWorkspaceAccountIdentities,
  removeWorkspaceAccountIdentity,
  startWorkspaceAccountLink,
} from "./account-identities.server"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"

export const getWorkspaceAccountIdentities = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ scenario: fixtureScenarioSchema.optional() }))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceAccountIdentities(data.scenario, context.requestSignal)
    )
  })

export const removeWorkspaceAccountIdentityFn = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ identityId: z.number().int().positive() }).strict())
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      removeWorkspaceAccountIdentity(data.identityId, context.requestSignal)
    )
  })

export const startWorkspaceAccountLinkFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        providerKey: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      startWorkspaceAccountLink(data.providerKey, context.requestSignal)
    )
  })

export const getPendingWorkspaceAccountLink = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      previewHubLink(context.requestSignal)
    )
  })

export const confirmWorkspaceAccountLinkFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      confirmHubLink(context.requestSignal)
    )
  })

export const cancelWorkspaceAccountLinkFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () => cancelHubLink())
  })
