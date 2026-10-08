import { useState } from "react"

export function useAccessListManagement() {
  const [managing, setManaging] = useState(false)
  const [savingKey, setSavingKey] = useState<string>()
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set())

  return {
    managing,
    setManaging,
    savingAnything: savingKey !== undefined,
    selection,
    clearSelection: () => setSelection(new Set()),
    isSaving: (key: string) => savingKey === key,
    stageOne: (key: string) => setSelection(new Set([key])),
    startSaving: (key: string) => setSavingKey(key),
    stopSaving: () => setSavingKey(undefined),
    toggleSelection: (key: string, checked: boolean) => {
      setSelection((current) => {
        const next = new Set(current)
        if (checked) {
          next.add(key)
        } else {
          next.delete(key)
        }
        return next
      })
    },
  }
}
