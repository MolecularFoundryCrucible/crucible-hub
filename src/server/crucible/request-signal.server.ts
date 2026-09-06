import "@tanstack/react-start/server-only"

const upstreamTimeoutMs = 15_000

export function crucibleRequestSignal(requestSignal?: AbortSignal) {
  const timeoutSignal = AbortSignal.timeout(upstreamTimeoutMs)
  return requestSignal
    ? AbortSignal.any([requestSignal, timeoutSignal])
    : timeoutSignal
}
