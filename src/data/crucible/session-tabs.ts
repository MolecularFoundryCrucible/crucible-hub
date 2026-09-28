const sessionChannelName = "crucible-hub-session"

export function announceHubSignOut() {
  if (typeof BroadcastChannel === "undefined") return
  const channel = new BroadcastChannel(sessionChannelName)
  channel.postMessage("sign-out")
  channel.close()
}

export function openHubSessionChannel() {
  return typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(sessionChannelName)
}
