import type {
  WorkspaceMetadataValue,
  WorkspaceScientificMetadata,
} from "./workspace-source"

function metadataValue(value: unknown): WorkspaceMetadataValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(metadataValue)
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, metadataValue(nested)])
    )
  }
  return null
}

export function normalizeScientificMetadata(
  value: unknown
): WorkspaceScientificMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, metadataValue(nested)])
  )
}
