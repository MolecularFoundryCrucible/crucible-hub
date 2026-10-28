import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  publishWorkspaceResourceAccess,
  readWorkspaceResourceAccess,
  revokeWorkspaceResourceAccessGrant,
  setWorkspaceResourceAccessGrant,
  unpublishWorkspaceResourceAccess,
} from "./access.server"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"

export const RESOURCE_ACCESS_MFID_MAX_LENGTH = 255

const canonicalResourceAccessMfidSchema = z
  .string()
  .trim()
  .min(1)
  .max(RESOURCE_ACCESS_MFID_MAX_LENGTH)
  .regex(/^[a-zA-Z0-9_-]+$/)

const resourceAccessPermissionSchema = z.enum([
  "viewer",
  "contributor",
  "editor",
  "admin",
])

const resourceAccessPrincipalKindSchema = z.enum(["users", "projects"])

export const resourceAccessInputSchema = z
  .object({
    resourceMfid: canonicalResourceAccessMfidSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

const resourceAccessGrantFields = {
  kind: resourceAccessPrincipalKindSchema,
  principal: canonicalResourceAccessMfidSchema,
  resourceMfid: canonicalResourceAccessMfidSchema,
  scenario: fixtureScenarioSchema.optional(),
}

export const setResourceAccessGrantInputSchema = z
  .object({
    ...resourceAccessGrantFields,
    permission: resourceAccessPermissionSchema,
  })
  .strict()

export const revokeResourceAccessGrantInputSchema = z
  .object(resourceAccessGrantFields)
  .strict()

export const getWorkspaceResourceAccess = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(resourceAccessInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceResourceAccess(
        data.resourceMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const setWorkspaceResourceAccess = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(setResourceAccessGrantInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      setWorkspaceResourceAccessGrant(
        data.resourceMfid,
        data.kind,
        data.principal,
        data.permission,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const revokeWorkspaceResourceAccess = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(revokeResourceAccessGrantInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      revokeWorkspaceResourceAccessGrant(
        data.resourceMfid,
        data.kind,
        data.principal,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const publishWorkspaceResource = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(resourceAccessInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      publishWorkspaceResourceAccess(
        data.resourceMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const unpublishWorkspaceResource = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(resourceAccessInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      unpublishWorkspaceResourceAccess(
        data.resourceMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })
