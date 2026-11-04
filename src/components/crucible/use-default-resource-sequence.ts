import { useEffect, useEffectEvent, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { createAnchoredResourceSiblingCollection } from "@/components/crucible/anchored-resource-siblings"
import { useAutomaticResourceSiblingSession } from "@/components/crucible/resource-sibling-navigation"
import type { ActiveResourceSiblingNavigation } from "@/components/crucible/resource-sibling-navigation"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  defaultResourceSequence,
  resolveResourceSequence,
  resourceSequenceAffiliation,
  resourceSequencePreferenceKey,
} from "@/data/crucible/resource-sequence"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import { useAccountPreferences } from "@/features/preferences/use-account-preferences"

export function useDefaultResourceSequence({
  enabled,
  navigation,
  resource,
  scope,
}: {
  enabled: boolean
  navigation: ActiveResourceSiblingNavigation | null
  resource: WorkspaceResourceDetail | null | undefined
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const session = useAutomaticResourceSiblingSession()
  const account = useAccountPreferences()
  const ready = !account.enabled || account.loaded || Boolean(account.error)
  const sequenceResource =
    resource?.kind === "dataset" || resource?.kind === "sample"
      ? resource
      : undefined
  const preference = sequenceResource
    ? account.preferences.hub?.resource_sequence?.[
        resourceSequencePreferenceKey(sequenceResource.kind)
      ]
    : undefined
  const includePublic = account.preferences.hub?.include_public_data === true
  const key = JSON.stringify([
    preference ?? defaultResourceSequence,
    includePublic,
  ])
  const off = preference?.scope === "off"
  const mfid = sequenceResource?.unique_id
  const attempt = `${mfid}:${key}`
  const [failedAttempt, setFailedAttempt] = useState<string>()
  const automaticKey = navigation?.automaticKey
  const chosenSequence = Boolean(navigation) && !automaticKey
  const eligible =
    enabled &&
    Boolean(session && mfid) &&
    !chosenSequence &&
    session?.clearedMfid !== mfid

  const build = useEffectEvent(async () => {
    if (!sequenceResource || !session) return null
    return {
      collection: await createAnchoredResourceSiblingCollection({
        affiliation: resourceSequenceAffiliation({
          includePublic,
          resource: sequenceResource,
          scope,
        }),
        configuration: resolveResourceSequence(preference, sequenceResource),
        queryClient,
        resource: sequenceResource,
        scope,
      }),
      activate: session.activate,
    }
  })
  const clearAutomatic = session?.clear

  useEffect(() => {
    if (!eligible || !ready) return
    if (off) {
      if (automaticKey) clearAutomatic?.()
      return
    }
    if (automaticKey === key) return
    let current = true
    build().then(
      (result) => {
        if (current) result?.activate(result.collection, key)
      },
      () => {
        if (current) setFailedAttempt(attempt)
      }
    )
    return () => {
      current = false
    }
  }, [attempt, automaticKey, clearAutomatic, eligible, key, off, ready])

  return eligible && !off && automaticKey !== key && failedAttempt !== attempt
}
