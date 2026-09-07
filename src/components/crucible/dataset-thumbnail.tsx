import type { WorkspaceDatasetThumbnail } from "@/data/crucible/workspace-source"

export function DatasetThumbnailImage({
  thumbnail,
  ...props
}: Omit<React.ComponentProps<"img">, "src"> & {
  thumbnail: WorkspaceDatasetThumbnail
}) {
  return (
    <img
      src={`data:${thumbnail.mime_type};base64,${thumbnail.thumbnail_b64str}`}
      {...props}
    />
  )
}
