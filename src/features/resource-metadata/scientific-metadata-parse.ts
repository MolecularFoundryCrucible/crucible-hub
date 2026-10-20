import { scientificMetadataValidationError } from "@/data/crucible/resources.functions"
import type {
  WorkspaceMetadataValue,
  WorkspaceScientificMetadata,
} from "@/data/crucible/workspace-source"

export type ScientificMetadataParseResult =
  | { metadata: WorkspaceScientificMetadata; ok: true }
  | { message: string; ok: false }

function isMetadataValue(value: unknown): value is WorkspaceMetadataValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return true
  }
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isMetadataValue)
  if (typeof value !== "object") return false
  return Object.values(value).every(isMetadataValue)
}

function isMetadataObject(
  value: unknown
): value is WorkspaceScientificMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    isMetadataValue(value)
  )
}

export function parseScientificMetadata(
  input: string
): ScientificMetadataParseResult {
  let value: unknown
  try {
    value = JSON.parse(input)
  } catch {
    return { message: "Enter valid JSON.", ok: false }
  }
  if (!isMetadataObject(value)) {
    return {
      message:
        "Scientific metadata must be a JSON object with finite JSON values.",
      ok: false,
    }
  }
  const validationError = scientificMetadataValidationError(value)
  if (validationError) return { message: validationError, ok: false }
  return { metadata: value, ok: true }
}
