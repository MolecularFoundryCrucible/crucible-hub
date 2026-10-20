import { Suspense, useState } from "react"
import { lazyRouteComponent } from "@tanstack/react-router"
import { EditableCardTrigger } from "@/components/crucible/editable-card-actions"
import {
  ScientificMetadataExpansionAction,
  ScientificMetadataViewer,
  useScientificMetadataExpansion,
} from "@/components/crucible/scientific-metadata"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type { WorkspaceScientificMetadata } from "@/data/crucible/workspace-source"

export type EditableResource = {
  capabilities?: { can_edit?: boolean } | null
  kind: "dataset" | "instrument" | "project" | "sample"
  scientific_metadata: WorkspaceScientificMetadata | null
  unique_id: string
}

const ScientificMetadataForm = lazyRouteComponent(
  () => import("./scientific-metadata-form"),
  "ScientificMetadataForm"
)

export function ScientificMetadataEditor({
  mode,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  resource: EditableResource
  scope: IdentityScope
}) {
  const [editing, setEditing] = useState(false)
  const expansion = useScientificMetadataExpansion(resource.scientific_metadata)
  const readView = (
    <Card>
      <CardHeader actionLayout="inline">
        <CardTitle>Scientific metadata</CardTitle>
        {expansion.canExpand || resource.capabilities?.can_edit === true ? (
          <CardAction>
            <div className="flex items-center justify-end gap-1">
              <ScientificMetadataExpansionAction expansion={expansion} />
              {resource.capabilities?.can_edit === true ? (
                <EditableCardTrigger
                  label="Edit scientific metadata"
                  onClick={() => setEditing(true)}
                  onPreload={() => void ScientificMetadataForm.preload?.()}
                />
              ) : null}
            </div>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <ScientificMetadataViewer
          emptyMessage={`This ${resource.kind} does not currently expose scientific metadata.`}
          expansion={expansion}
          metadata={resource.scientific_metadata}
        />
      </CardContent>
    </Card>
  )
  if (!editing) return readView
  return (
    <Suspense fallback={readView}>
      <ScientificMetadataForm
        mode={mode}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
        resource={resource}
        scope={scope}
      />
    </Suspense>
  )
}
