import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"
import {
  collectionAffiliationSchema,
  collectionCursorSchema,
  sortDirectionSchema,
} from "./collection-query"

import {
  addWorkspaceProjectMember as addWorkspaceProjectMemberServer,
  checkWorkspaceProjectIdExactMatch,
  patchWorkspaceProject,
  readWorkspaceProject,
  readWorkspaceProjects,
  readWorkspaceUserProjects,
  removeWorkspaceProjectMember as removeWorkspaceProjectMemberServer,
  updateWorkspaceProjectMemberRole as updateWorkspaceProjectMemberRoleServer,
} from "./projects.server"
import { projectIdSchema } from "./slugs"
import { queryCancellationMiddleware } from "./query-cancellation"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { privilegeModeSchema } from "./privilege-mode"

export const projectSortSchema = z.enum([
  "project_id",
  "title",
  "created",
  "updated",
  "activity",
])

export const projectMemberRoleFilterSchema = z.enum([
  "viewer",
  "contributor",
  "editor",
  "admin",
  "owner",
])

export const projectListInputSchema = z.object({
  affiliation: collectionAffiliationSchema.optional(),
  cursor: collectionCursorSchema,
  direction: sortDirectionSchema.optional(),
  includeTotal: z.boolean().optional(),
  limit: z.number().int().min(1).max(100),
  memberRef: z
    .union([z.string().trim().min(1), z.array(z.string().trim().min(1))])
    .optional(),
  memberRole: z
    .union([
      projectMemberRoleFilterSchema,
      z.array(projectMemberRoleFilterSchema),
    ])
    .optional(),
  privilegeMode: privilegeModeSchema.optional(),
  scenario: fixtureScenarioSchema.optional(),
  sort: projectSortSchema.optional(),
})

export const userProjectListInputSchema = z
  .object({
    cursor: collectionCursorSchema,
    direction: sortDirectionSchema.optional(),
    includeTotal: z.boolean().optional(),
    limit: z.number().int().min(1).max(100),
    privilegeMode: privilegeModeSchema.optional(),
    scenario: fixtureScenarioSchema.optional(),
    sort: projectSortSchema.optional(),
    userRef: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z0-9_-]+$/),
  })
  .strict()

export const projectDetailInputSchema = z.object({
  privilegeMode: privilegeModeSchema,
  projectMfid: z.string().trim().min(1).max(255),
  projection: z.enum(["overview", "summary"]),
  scenario: fixtureScenarioSchema.optional(),
})

const projectTextChangeSchema = z.string().trim().min(1).max(255).optional()
const projectTitleChangeSchema = projectTextChangeSchema.nullable()

const canonicalUserIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/)

const canonicalProjectMfidSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/)

export const projectMembershipRoleSchema = z.enum([
  "viewer",
  "contributor",
  "editor",
  "admin",
])

const projectMemberInputFields = {
  projectMfid: canonicalProjectMfidSchema,
  scenario: fixtureScenarioSchema.optional(),
  userId: canonicalUserIdSchema,
}

export const addProjectMemberInputSchema = z
  .object({
    ...projectMemberInputFields,
    role: projectMembershipRoleSchema,
  })
  .strict()

export const updateProjectMemberRoleInputSchema = z
  .object({
    ...projectMemberInputFields,
    role: projectMembershipRoleSchema,
  })
  .strict()

export const removeProjectMemberInputSchema = z
  .object(projectMemberInputFields)
  .strict()

export const projectDescriptiveUpdateInputSchema = z
  .object({
    changes: z
      .object({
        organization: projectTextChangeSchema,
        project_id: projectIdSchema.optional(),
        title: projectTitleChangeSchema,
      })
      .strict()
      .refine(
        (changes) =>
          changes.organization !== undefined ||
          changes.project_id !== undefined ||
          changes.title !== undefined,
        "At least one project change is required."
      ),
    projectMfid: z.string().trim().min(1).max(255),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const getWorkspaceProjects = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(projectListInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceProjects(data, context.requestSignal)
    )
  })

export const getWorkspaceUserProjects = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(userProjectListInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceUserProjects(data, context.requestSignal)
    )
  })

export const getWorkspaceProject = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(projectDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceProject(
        data.projectMfid,
        data.scenario,
        context.requestSignal,
        data.projection,
        data.privilegeMode
      )
    )
  })

export const updateWorkspaceProject = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(projectDescriptiveUpdateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      patchWorkspaceProject(
        data.projectMfid,
        data.changes,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const addWorkspaceProjectMember = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(addProjectMemberInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      addWorkspaceProjectMemberServer(
        data.projectMfid,
        data.userId,
        data.role,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const updateWorkspaceProjectMemberRole = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(updateProjectMemberRoleInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      updateWorkspaceProjectMemberRoleServer(
        data.projectMfid,
        data.userId,
        data.role,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const removeWorkspaceProjectMember = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(removeProjectMemberInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      removeWorkspaceProjectMemberServer(
        data.projectMfid,
        data.userId,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const checkWorkspaceProjectId = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z.object({
      projectId: projectIdSchema,
      scenario: fixtureScenarioSchema.optional(),
    })
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      checkWorkspaceProjectIdExactMatch(
        data.projectId,
        data.scenario,
        context.requestSignal
      )
    )
  })
