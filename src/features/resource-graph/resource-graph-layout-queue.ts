export class LayoutSupersededError extends Error {
  constructor() {
    super("A newer graph layout replaced this one before it started.")
    this.name = "LayoutSupersededError"
  }
}

type WaitingLayout<TInput, TOutput> = {
  input: TInput
  reject: (error: unknown) => void
  resolve: (value: TOutput) => void
}

/**
 * Runs one layout at a time. A layout that is still waiting when a newer one
 * arrives is rejected with LayoutSupersededError instead of being run, and
 * the timeout counts only from when a layout starts.
 */
export function createLayoutQueue<TEngine, TInput, TOutput>({
  engine,
  layout,
  onFailure,
  timeoutMs,
}: {
  engine: () => TEngine
  layout: (engine: TEngine, input: TInput) => Promise<TOutput>
  onFailure: (failed: TEngine) => void
  timeoutMs: number
}) {
  let running = false
  let waiting: WaitingLayout<TInput, TOutput> | null = null

  const startNext = () => {
    const job = waiting
    waiting = null
    if (!job) {
      running = false
      return
    }
    running = true
    let current: TEngine | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Resource graph layout calculation timed out"))
      }, timeoutMs)
    })
    const result = Promise.resolve().then(() => {
      current = engine()
      return layout(current, job.input)
    })
    Promise.race([result, timeout])
      .then(job.resolve, (error: unknown) => {
        if (current !== undefined) onFailure(current)
        job.reject(error)
      })
      .finally(() => {
        clearTimeout(timer)
        startNext()
      })
  }

  return {
    idle: () => !running && !waiting,
    run: (input: TInput) =>
      new Promise<TOutput>((resolve, reject) => {
        waiting?.reject(new LayoutSupersededError())
        waiting = { input, reject, resolve }
        if (!running) startNext()
      }),
  }
}
