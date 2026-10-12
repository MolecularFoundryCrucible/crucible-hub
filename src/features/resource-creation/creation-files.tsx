import { useUploadBatch } from "@/features/dataset-files/upload-batch"
import type { UploadBatch } from "@/features/dataset-files/upload-batch"
import {
  UploadDropZone,
  UploadFileList,
} from "@/features/dataset-files/upload-file-list"

export function CreationFilesField({
  batch,
  datasetMfid,
  disabled,
}: {
  batch: UploadBatch
  datasetMfid?: string
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <UploadDropZone
        compact={batch.items.length > 0}
        disabled={disabled || batch.uploading}
        onAdd={batch.add}
      />
      <UploadFileList batch={batch} datasetMfid={datasetMfid} />
    </div>
  )
}

export function useCreationFileSubmission() {
  const batch = useUploadBatch()
  const failures = batch.items.filter(
    (item) =>
      item.state.status === "error" ||
      item.state.status === "aborted" ||
      (item.state.status === "done" &&
        item.state.ingestion !== undefined &&
        item.state.ingestion !== "requested")
  )

  return {
    apply: (resourceMfid: string) =>
      batch.items.length ? batch.start(resourceMfid) : Promise.resolve(true),
    batch,
    failures,
    isPending: batch.uploading,
  }
}
