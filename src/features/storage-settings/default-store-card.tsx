import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"

import { EditableCardActions } from "@/components/crucible/editable-card-actions"
import { InlineError } from "@/components/crucible/form-error"
import { notifySuccess } from "@/components/crucible/notifications"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { updateDefaultStoreFn } from "@/data/crucible/resource-settings.functions"
import { resourceSettingsQueryOptions } from "@/data/crucible/resource-settings.queries"
import { storesQueryOptions } from "@/data/crucible/resources.queries"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type {
  WorkspaceResourceSettings,
  WorkspaceSettingsKind,
} from "@/data/crucible/workspace-source"

const fallbackDescription: Record<WorkspaceSettingsKind, string> = {
  instrument:
    "Uploads to this instrument's datasets go here when neither the upload nor the dataset's project chooses a store.",
  project:
    "Uploads to this project's datasets go here unless an upload chooses another store.",
}

function saveError(error: unknown) {
  const code =
    error instanceof HubApiClientError ? error.details.conflictCode : undefined
  if (code === "etag_mismatch") {
    return "These settings changed since you opened them. Review the current store and save again."
  }
  if (code === "unknown_store") {
    return "That store isn't configured on this Crucible server."
  }
  return hubErrorMessage(error, "The default store could not be saved.")
}

export function DefaultStoreCard({
  kind,
  mfid,
}: {
  kind: WorkspaceSettingsKind
  mfid: string
}) {
  const scope = useWorkspaceScope()
  const stores = useQuery(storesQueryOptions(scope))
  const settings = useQuery(resourceSettingsQueryOptions(scope, kind, mfid))
  const current = settings.data?.defaultStoreId ?? null
  const relevant =
    (stores.data?.length ?? 0) > 1 || (settings.data && current !== null)
  if (!stores.data || !settings.data || !relevant) {
    return settings.isError || stores.isError ? (
      <Card>
        <CardHeader>
          <CardTitle>File storage</CardTitle>
        </CardHeader>
        <CardContent>
          <InlineError>The storage settings could not be loaded.</InlineError>
        </CardContent>
      </Card>
    ) : null
  }
  return (
    <DefaultStoreForm
      key={settings.data.etag}
      kind={kind}
      mfid={mfid}
      settings={settings.data}
      stores={stores.data}
    />
  )
}

function DefaultStoreForm({
  kind,
  mfid,
  settings,
  stores,
}: {
  kind: WorkspaceSettingsKind
  mfid: string
  settings: WorkspaceResourceSettings
  stores: readonly { default: boolean; display_name: string; id: string }[]
}) {
  const scope = useWorkspaceScope()
  const queryClient = useQueryClient()
  const formId = useId()
  const selectId = useId()
  const current = settings.defaultStoreId ?? ""
  const [value, setValue] = useState(current)
  const [error, setError] = useState<string>()
  const serverDefault = stores.find((store) => store.default)
  const unconfigured =
    settings.defaultStoreId !== null &&
    !stores.some((store) => store.id === settings.defaultStoreId)
  const save = useMutation({
    mutationFn: async (defaultStoreId: string | null) =>
      unwrapHubResult(
        await updateDefaultStoreFn({
          data: {
            defaultStoreId,
            etag: settings.etag,
            kind,
            mfid,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
    onSuccess: (next) => {
      queryClient.setQueryData(crucibleKeys.resourceSettings(scope, mfid), next)
      notifySuccess("Default store saved")
    },
    onError: (cause) => {
      setError(saveError(cause))
      if (
        cause instanceof HubApiClientError &&
        cause.details.conflictCode === "etag_mismatch"
      ) {
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.resourceSettings(scope, mfid),
        })
      }
    },
  })

  return (
    <Card aria-busy={save.isPending}>
      <CardHeader>
        <CardTitle>File storage</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          id={formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (value === current || save.isPending) return
            setError(undefined)
            save.mutate(value || null)
          }}
        >
          <Field>
            <FieldLabel htmlFor={selectId}>Default store</FieldLabel>
            <NativeSelect
              className="w-full"
              disabled={save.isPending}
              id={selectId}
              onChange={(event) => setValue(event.target.value)}
              value={value}
            >
              <NativeSelectOption value="">
                {serverDefault
                  ? `Server default (${serverDefault.display_name})`
                  : "Server default"}
              </NativeSelectOption>
              {stores.map((store) => (
                <NativeSelectOption key={store.id} value={store.id}>
                  {store.display_name}
                </NativeSelectOption>
              ))}
              {unconfigured ? (
                <NativeSelectOption value={current}>
                  {current} (not configured)
                </NativeSelectOption>
              ) : null}
            </NativeSelect>
            <FieldDescription>
              {unconfigured
                ? "This store isn't configured on the server any more, so uploads use the next default. Choose another store."
                : fallbackDescription[kind]}
            </FieldDescription>
          </Field>
          {error ? (
            <InlineError className="mt-3" role="alert">
              {error}
            </InlineError>
          ) : null}
        </form>
      </CardContent>
      {value !== current || save.isPending ? (
        <EditableCardActions
          canSubmit
          dirty={value !== current}
          formId={formId}
          onCancel={() => {
            setValue(current)
            setError(undefined)
          }}
          pending={save.isPending}
        />
      ) : null}
    </Card>
  )
}
