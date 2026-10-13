import { Suspense, useState } from "react"
import { lazyRouteComponent } from "@tanstack/react-router"
import { EditScientificMetadataIcon } from "@/components/crucible/icons"
import {
  ScientificMetadataExpansionAction,
  ScientificMetadataViewer,
  useScientificMetadataExpansion,
} from "@/components/crucible/scientific-metadata"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"

export type EditableResource = Extract<
  WorkspaceResourceDetail,
  { kind: "dataset" | "sample" }
>

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
                <EditScientificMetadataButton
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
          emptyMessage="This resource does not currently expose scientific metadata."
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

function EditScientificMetadataButton({
  onClick,
  onPreload,
}: {
  onClick: () => void
  onPreload: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Edit scientific metadata"
            onClick={onClick}
            onFocus={onPreload}
            onMouseEnter={onPreload}
            onTouchStart={onPreload}
            size="icon-sm"
            variant="outline"
          />
        }
      >
        <EditScientificMetadataIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Edit scientific metadata</TooltipContent>
    </Tooltip>
  )
}
