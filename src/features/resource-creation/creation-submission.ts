import { useState } from "react"

import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import {
  creationFailureMessage,
  isUncertainCreationError,
} from "@/features/resource-creation/creation-error"
import type { CreationMetadataDraft } from "@/features/resource-creation/creation-metadata"
import type { CreationRelationshipDraft } from "@/features/resource-creation/creation-relationships"

type StagedCreationKind = "dataset" | "sample"

type StagedValues = {
  metadata: CreationMetadataDraft
  relationships: CreationRelationshipDraft[]
}

export function useStagedCreation<TValues extends StagedValues>({
  create,
  files,
  kind,
  metadata,
  onCreated,
  relationships,
}: {
  create: (value: TValues) => Promise<WorkspaceResourceDetail>
  files?: { apply: (resourceMfid: string) => Promise<boolean> }
  kind: StagedCreationKind
  metadata: {
    apply: (
      resourceMfid: string,
      draft: CreationMetadataDraft
    ) => Promise<boolean>
  }
  onCreated?: (resource: WorkspaceResourceDetail) => void
  relationships: {
    apply: (
      resourceMfid: string,
      drafts: readonly CreationRelationshipDraft[]
    ) => Promise<boolean>
  }
}) {
  const [saveError, setSaveError] = useState<string>()
  const [uncertainOutcome, setUncertainOutcome] = useState(false)
  const [created, setCreated] = useState<WorkspaceResourceDetail>()

  async function submit(
    value: TValues,
    onApplied: (resource: WorkspaceResourceDetail) => Promise<void>
  ) {
    setSaveError(undefined)
    if (created) {
      const complete = await applyStages(created.unique_id, value)
      if (complete) await onApplied(created)
      return
    }
    if (uncertainOutcome) return
    try {
      const resource = await create(value)
      if (resource.kind !== kind) {
        throw new Error(`The ${kind} creation response is invalid.`)
      }
      setCreated(resource)
      onCreated?.(resource)
      const complete = await applyStages(resource.unique_id, value)
      if (complete) await onApplied(resource)
    } catch (error) {
      setUncertainOutcome(isUncertainCreationError(error))
      setSaveError(creationFailureMessage(kind, error))
    }
  }

  async function applyStages(resourceMfid: string, value: TValues) {
    const metadataComplete = await metadata.apply(resourceMfid, value.metadata)
    const relationshipsComplete = await relationships.apply(
      resourceMfid,
      value.relationships
    )
    const filesComplete = files ? await files.apply(resourceMfid) : true
    return metadataComplete && relationshipsComplete && filesComplete
  }

  return { created, saveError, setCreated, submit, uncertainOutcome }
}
