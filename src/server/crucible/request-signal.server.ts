import "@tanstack/react-start/server-only"

const upstreamTimeoutMs = 15_000

export function crucibleRequestSignal(
  requestSignal?: AbortSignal,
  timeoutMs = upstreamTimeoutMs
) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  return requestSignal
    ? AbortSignal.any([requestSignal, timeoutSignal])
    : timeoutSignal
}
