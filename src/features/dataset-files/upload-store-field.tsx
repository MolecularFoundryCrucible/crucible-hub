import { useQuery } from "@tanstack/react-query"
import { useId } from "react"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { resourceSettingsQueryOptions } from "@/data/crucible/resource-settings.queries"
import {
  resourceQueryOptions,
  storesQueryOptions,
} from "@/data/crucible/resources.queries"
import type { WorkspaceStore } from "@/data/crucible/workspace-source"

function useRecordDefault(kind: "project" | "instrument", mfid?: string) {
  const scope = useWorkspaceScope()
  return useQuery({
    ...resourceSettingsQueryOptions(scope, kind, mfid ?? ""),
    enabled: Boolean(mfid),
  }).data?.defaultStoreId
}

function useEffectiveDefault(
  datasetMfid: string,
  stores: readonly WorkspaceStore[]
) {
  const scope = useWorkspaceScope()
  const dataset = useQuery(resourceQueryOptions(scope, datasetMfid)).data
  const relations =
    dataset?.kind === "dataset"
      ? {
          instrument: dataset.instrument?.unique_id,
          project: dataset.project?.unique_id,
        }
      : {}
  const projectDefault = useRecordDefault("project", relations.project)
  const instrumentDefault = useRecordDefault("instrument", relations.instrument)
  const configured = (id: string | null | undefined) =>
    stores.find((store) => store.id === id)
  return (
    configured(projectDefault) ??
    configured(instrumentDefault) ??
    stores.find((store) => store.default)
  )
}

export function UploadStoreField({
  datasetMfid,
  disabled,
  onChange,
  value,
}: {
  datasetMfid: string
  disabled: boolean
  onChange: (storeId: string) => void
  value: string
}) {
  const scope = useWorkspaceScope()
  const stores = useQuery(storesQueryOptions(scope)).data ?? []
  if (stores.length < 2) return null
  return (
    <StoreSelect
      datasetMfid={datasetMfid}
      disabled={disabled}
      onChange={onChange}
      stores={stores}
      value={value}
    />
  )
}

function StoreSelect({
  datasetMfid,
  disabled,
  onChange,
  stores,
  value,
}: {
  datasetMfid: string
  disabled: boolean
  onChange: (storeId: string) => void
  stores: readonly WorkspaceStore[]
  value: string
}) {
  const id = useId()
  const effective = useEffectiveDefault(datasetMfid, stores)
  return (
    <Field>
      <FieldLabel htmlFor={id}>Store</FieldLabel>
      <NativeSelect
        className="w-full sm:w-80"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <NativeSelectOption value="">
          {effective ? `Default (${effective.display_name})` : "Default"}
        </NativeSelectOption>
        {stores.map((store) => (
          <NativeSelectOption key={store.id} value={store.id}>
            {store.display_name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  )
}
