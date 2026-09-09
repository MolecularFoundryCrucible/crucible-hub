const MFID_PATTERN = /^[0-9a-hjkmnp-tv-z]{26}$/i
const RESOURCE_PATH_PATTERN =
  /\/(?:datasets|samples|instruments?|projects|resources)\/([0-9a-hjkmnp-tv-z]{26})(?:\/|$)/i

export function extractMfidFromQrCode(
  rawValue: string,
  currentHostname: string
) {
  const value = rawValue.trim()
  if (MFID_PATTERN.test(value)) return value.toLowerCase()

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  const trustedHosts = new Set([currentHostname, "crucible.lbl.gov"])
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !trustedHosts.has(url.hostname) ||
    url.username ||
    url.password
  ) {
    return null
  }

  return url.pathname.match(RESOURCE_PATH_PATTERN)?.[1]?.toLowerCase() ?? null
}
