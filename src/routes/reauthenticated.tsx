import { useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { AuthPage } from "@/components/crucible/auth-page"
import { REAUTHENTICATION_CHANNEL } from "@/components/crucible/reauthentication"
import { Button } from "@/components/ui/button"
import { hubPageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/reauthenticated")({
  head: () => ({ meta: [{ title: hubPageTitle("Signed in again") }] }),
  component: Reauthenticated,
})

function Reauthenticated() {
  useEffect(() => {
    const channel = new BroadcastChannel(REAUTHENTICATION_CHANNEL)
    channel.postMessage("reauthenticated")
    channel.close()
    window.close()
  }, [])

  return (
    <AuthPage
      description="You can close this window and continue where you left off."
      title="Signed in again"
    >
      <Button
        className="w-full"
        nativeButton={false}
        render={<a href="/hub/" />}
        size="lg"
        variant="outline"
      >
        Return to Crucible Hub
      </Button>
    </AuthPage>
  )
}
