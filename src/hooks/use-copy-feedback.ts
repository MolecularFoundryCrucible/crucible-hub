import { useEffect, useState } from "react"

export type CopyState = "error" | "idle" | "success"

const SUCCESS_DURATION = 2000

/**
 * Copies text and reports the result. Success clears itself after a short
 * time; an error stays until the next attempt so its guidance can be read.
 */
export function useCopyFeedback() {
  const [feedback, setFeedback] = useState<{ state: CopyState }>({
    state: "idle",
  })

  useEffect(() => {
    if (feedback.state !== "success") return
    const timeout = window.setTimeout(
      () => setFeedback({ state: "idle" }),
      SUCCESS_DURATION
    )
    return () => window.clearTimeout(timeout)
  }, [feedback])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setFeedback({ state: "success" })
    } catch {
      setFeedback({ state: "error" })
    }
  }

  return {
    copy,
    reset: () => setFeedback({ state: "idle" }),
    state: feedback.state,
  }
}
