export type TransferEstimate = {
  bytesPerSecond: number
  secondsRemaining?: number
}

const MIN_SAMPLE_MS = 200
const ESTIMATE_AFTER_MS = 2000

export function createTransferRate(halfLifeMs = 3000) {
  let firstTime: number | undefined
  let lastTime = 0
  let lastBytes = 0
  let rate: number | undefined

  return {
    update(
      bytes: number,
      totalBytes: number,
      now = performance.now()
    ): TransferEstimate | undefined {
      if (firstTime === undefined) {
        if (bytes <= 0) return undefined
        firstTime = now
        lastTime = now
        lastBytes = bytes
        return undefined
      }
      const elapsed = now - lastTime
      if (elapsed >= MIN_SAMPLE_MS) {
        const instant = (Math.max(0, bytes - lastBytes) / elapsed) * 1000
        const weight = 1 - 2 ** (-elapsed / halfLifeMs)
        rate = rate === undefined ? instant : rate + weight * (instant - rate)
        lastTime = now
        lastBytes = bytes
      }
      if (rate === undefined || now - firstTime < ESTIMATE_AFTER_MS) {
        return undefined
      }
      return {
        bytesPerSecond: rate,
        secondsRemaining:
          rate > 0 ? Math.max(0, totalBytes - bytes) / rate : undefined,
      }
    },
  }
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}
