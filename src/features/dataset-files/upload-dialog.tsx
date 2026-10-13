import { useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { datasetFilesQueryOptions } from "@/data/crucible/resources.queries"

import { useUploadBatch } from "./upload-batch"
import { UploadDropZone, UploadFileList } from "./upload-file-list"
import { UploadLeaveDialog } from "./upload-leave-guard"

export function UploadFilesDialog({
  datasetMfid,
  onClose,
  open,
}: {
  datasetMfid: string
  onClose: () => void
  open: boolean
}) {
  const scope = useWorkspaceScope()
  const filesResult = useQuery(datasetFilesQueryOptions(scope, datasetMfid))
  const existingFilenames = useMemo(
    () => new Set(filesResult.data?.map((file) => file.filename)),
    [filesResult.data]
  )
  const batch = useUploadBatch({ existingFilenames })
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const closeAfterUpload = useRef(false)

  function close() {
    batch.reset()
    onClose()
  }

  function requestClose() {
    if (batch.uploading) {
      setConfirmingCancel(true)
      return
    }
    close()
  }

  async function upload() {
    await batch.start(datasetMfid)
    if (closeAfterUpload.current) {
      closeAfterUpload.current = false
      close()
    }
  }

  const allUploaded = batch.items.length > 0 && batch.pendingCount === 0

  return (
    <>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose()
        }}
        open={open}
      >
        <DialogContent className="flex flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add files</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {batch.uploading ? null : (
              <UploadDropZone
                compact={batch.items.length > 0}
                disabled={batch.uploading}
                onAdd={batch.add}
              />
            )}
            <UploadFileList batch={batch} datasetMfid={datasetMfid} />
          </div>
          <DialogFooter>
            {batch.uploading ? (
              <Button
                onClick={batch.cancel}
                type="button"
                variant="destructive"
              >
                Cancel upload
              </Button>
            ) : allUploaded ? (
              <Button onClick={close} type="button">
                Done
              </Button>
            ) : (
              <>
                <Button onClick={requestClose} type="button" variant="outline">
                  Cancel
                </Button>
                <Button
                  disabled={batch.pendingCount === 0 || batch.blocked}
                  onClick={() => void upload()}
                  type="button"
                >
                  {batch.pendingCount > 0
                    ? `Upload ${batch.pendingCount} ${
                        batch.pendingCount === 1 ? "file" : "files"
                      }`
                    : "Upload files"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        cancelLabel="Keep uploading"
        confirmLabel="Cancel upload"
        description="Files that already finished stay in the dataset."
        kind="alert"
        onConfirm={() => {
          setConfirmingCancel(false)
          closeAfterUpload.current = true
          batch.cancel()
        }}
        onOpenChange={setConfirmingCancel}
        open={confirmingCancel}
        title="Cancel the upload?"
        variant="destructive"
      />
      <UploadLeaveDialog {...batch.leaveGuard} />
    </>
  )
}
