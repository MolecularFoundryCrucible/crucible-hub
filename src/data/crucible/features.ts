import { z } from "zod"

const workspaceFeatureNames = [
  "ingestion",
  "passwords",
  "printing",
  "proposal_sync",
  "uploads",
] as const

export type WorkspaceFeature = (typeof workspaceFeatureNames)[number]

export type WorkspaceFeatures = Record<WorkspaceFeature, boolean>

export const allFeaturesEnabled: WorkspaceFeatures = {
  ingestion: true,
  passwords: true,
  printing: true,
  proposal_sync: true,
  uploads: true,
}

const featuresBodySchema = z.object(
  Object.fromEntries(
    workspaceFeatureNames.map((name) => [name, z.boolean().optional()])
  ) as Record<WorkspaceFeature, z.ZodOptional<z.ZodBoolean>>
)

export function workspaceFeatures(body: unknown): WorkspaceFeatures {
  const parsed = featuresBodySchema.safeParse(body)
  if (!parsed.success) return allFeaturesEnabled
  return Object.fromEntries(
    workspaceFeatureNames.map((name) => [name, parsed.data[name] ?? true])
  ) as WorkspaceFeatures
}
