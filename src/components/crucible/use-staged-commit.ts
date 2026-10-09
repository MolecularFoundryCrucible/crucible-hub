import { useCallback, useState } from "react"

export function useStagedCommit({
  errorLabel,
  items,
  onAction,
  onDone,
}: {
  errorLabel: (count: number) => string
  items: readonly { id: string }[]
  onAction: (id: string) => Promise<unknown>
  onDone: () => void
}) {
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string>()

  const reset = useCallback(() => {
    setCommitting(false)
    setCommitError(undefined)
  }, [])

  const clearError = useCallback(() => {
    setCommitError(undefined)
  }, [])

  async function commit() {
    if (items.length === 0 || committing) return
    setCommitting(true)
    setCommitError(undefined)
    const pending = items
    const failures: string[] = []
    for (const item of pending) {
      try {
        await onAction(item.id)
      } catch {
        failures.push(item.id)
      }
    }
    setCommitting(false)
    if (failures.length === 0) {
      onDone()
    } else {
      setCommitError(errorLabel(failures.length))
    }
  }

  return { clearError, commit, commitError, committing, reset }
}
