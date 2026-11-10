import type {
  WorkspacePostprocessingParameters,
  WorkspaceScientificMetadata,
} from "@/data/crucible/workspace-source"

export type PipelineParameterField = {
  description?: string
  kind: "boolean" | "choice" | "integer" | "number" | "text"
  label: string
  name: string
  options?: string[]
  required: boolean
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function words(name: string) {
  const text = name.replaceAll("_", " ").trim()
  return text ? text[0].toUpperCase() + text.slice(1) : name
}

export function pipelineLabel(name: string) {
  return words(name)
}

export function pipelineDescription(description: string) {
  return words(description.replace(/^Postprocessing:\s*/i, ""))
}

/** Form fields for a pipeline's JSON Schema, or null when it uses a shape the form cannot show. */
export function pipelineParameterFields(
  schema: WorkspaceScientificMetadata
): PipelineParameterField[] | null {
  const properties = isRecord(schema.properties) ? schema.properties : {}
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((name) => typeof name === "string")
      : []
  )
  const fields: PipelineParameterField[] = []
  for (const [name, property] of Object.entries(properties)) {
    if (!isRecord(property)) return null
    const base = {
      description:
        typeof property.description === "string"
          ? property.description
          : undefined,
      label: typeof property.title === "string" ? property.title : words(name),
      name,
      required: required.has(name),
    }
    if (Array.isArray(property.enum)) {
      if (!property.enum.every((option) => typeof option === "string")) {
        return null
      }
      fields.push({ ...base, kind: "choice", options: property.enum })
    } else if (
      property.type === "string" ||
      property.type === "number" ||
      property.type === "integer" ||
      property.type === "boolean"
    ) {
      fields.push({
        ...base,
        kind: property.type === "string" ? "text" : property.type,
      })
    } else {
      return null
    }
  }
  return fields
}

/** Parameters to send, leaving out empty optional fields; null when a value is missing or invalid. */
export function pipelineParameters(
  fields: readonly PipelineParameterField[],
  values: Readonly<Record<string, string | boolean>>
): WorkspacePostprocessingParameters | null {
  const parameters: Record<string, boolean | number | string> = {}
  for (const field of fields) {
    const value = values[field.name]
    if (field.kind === "boolean") {
      parameters[field.name] = value === true
      continue
    }
    const text = typeof value === "string" ? value.trim() : ""
    if (!text) {
      if (field.required) return null
      continue
    }
    if (field.kind === "number" || field.kind === "integer") {
      const number = Number(text)
      if (
        !Number.isFinite(number) ||
        (field.kind === "integer" && !Number.isInteger(number))
      ) {
        return null
      }
      parameters[field.name] = number
    } else {
      parameters[field.name] = text
    }
  }
  return parameters
}
