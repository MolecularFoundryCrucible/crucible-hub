export function resourceDisplayName(
  kind: "sample" | "dataset" | "project" | "instrument",
  name: string | null | undefined,
  identity?: { identifier?: string | null; mfid?: string | null }
) {
  if (name?.trim()) return name
  if (kind === "sample") return "Untitled sample"
  if (kind === "dataset") return "Untitled dataset"
  return identity?.identifier?.trim() || identity?.mfid?.trim() || ""
}

export function resourceDetailDisplayName(resource: {
  kind: "sample" | "dataset" | "project" | "instrument"
  name: string | null | undefined
  unique_id: string
  project_id?: string | null
  instrument_id?: string | null
}) {
  return resourceDisplayName(resource.kind, resource.name, {
    identifier:
      resource.kind === "project"
        ? resource.project_id
        : resource.kind === "instrument"
          ? resource.instrument_id
          : null,
    mfid: resource.unique_id,
  })
}
