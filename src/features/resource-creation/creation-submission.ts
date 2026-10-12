import { useState } from "react"
import type { AnyFormApi } from "@tanstack/react-form"

import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import {
  creationFailureMessage,
  isUncertainCreationError,
} from "@/features/resource-creation/creation-error"
import type { CreationRelationshipDraft } from "@/features/resource-creation/creation-relationships"

type StagedCreationKind = "dataset" | "sample"

type StagedValues = { relationships: CreationRelationshipDraft[] }

export function useStagedCreation<TValues extends StagedValues>({
  create,
  files,
  kind,
  onCreated,
  relationships,
}: {
  create: (value: TValues) => Promise<WorkspaceResourceDetail>
  files?: { apply: (resourceMfid: string) => Promise<boolean> }
  kind: StagedCreationKind
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
    formApi: AnyFormApi,
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
      formApi.reset(value)
      const complete = await applyStages(resource.unique_id, value)
      if (complete) await onApplied(resource)
    } catch (error) {
      setUncertainOutcome(isUncertainCreationError(error))
      setSaveError(creationFailureMessage(kind, error))
    }
  }

  async function applyStages(resourceMfid: string, value: TValues) {
    const relationshipsComplete = await relationships.apply(
      resourceMfid,
      value.relationships
    )
    const filesComplete = files ? await files.apply(resourceMfid) : true
    return relationshipsComplete && filesComplete
  }

  return { created, saveError, setCreated, submit, uncertainOutcome }
}
