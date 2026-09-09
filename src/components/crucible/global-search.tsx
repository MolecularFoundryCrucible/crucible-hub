import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

import { ScanQrCodeIcon, SearchIcon } from "@/components/crucible/icons"
import { QrCodeScanner } from "@/components/crucible/qr-code-scanner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function GlobalSearch({ projectMfid }: { projectMfid?: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"search" | "scanner">("search")
  const [query, setQuery] = useState("")
  const [searchScope, setSearchScope] = useState<"global" | "project">("global")

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLocaleLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey)
      ) {
        if (event.shiftKey && !projectMfid) return
        event.preventDefault()
        setSearchScope(event.shiftKey ? "project" : "global")
        setOpen(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [projectMfid])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedQuery = query.trim()
    if (normalizedQuery.length < 3) return
    setOpen(false)
    void navigate({
      to: "/search",
      search: {
        kind: undefined,
        projectMfid: searchScope === "project" ? projectMfid : undefined,
        q: normalizedQuery,
      },
    })
  }

  const openScannedResource = useCallback(
    (resourceMfid: string) => {
      setOpen(false)
      setMode("search")
      void navigate({
        params: { resourceMfid },
        search: {},
        to: "/resources/$resourceMfid",
      })
    },
    [navigate]
  )

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) setMode("search")
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        onClick={() => setSearchScope("global")}
        render={
          <Button
            className="min-w-0 flex-1 justify-start sm:max-w-sm"
            variant="outline"
          />
        }
      >
        <SearchIcon aria-hidden="true" className="text-muted-foreground" />
        <span className="truncate text-muted-foreground">Search Crucible</span>
        <kbd
          className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-label-compact sm:inline"
          aria-hidden="true"
        >
          Ctrl K
        </kbd>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "scanner"
              ? "Scan a Crucible code"
              : searchScope === "project"
                ? "Search project data"
                : "Search Crucible"}
          </DialogTitle>
          <DialogDescription>
            {mode === "scanner"
              ? "Use your camera to open the resource identified by an MFID QR code."
              : searchScope === "project"
                ? "Find samples and datasets related to this project by name."
                : "Find projects, instruments, samples, and datasets by name or enter a complete MFID."}
          </DialogDescription>
        </DialogHeader>
        {mode === "scanner" ? (
          <QrCodeScanner
            onBack={() => setMode("search")}
            onMfid={openScannedResource}
          />
        ) : (
          <div className="grid gap-2">
            <form className="flex gap-2" onSubmit={submit}>
              <label className="sr-only" htmlFor="global-search-query">
                Search query
              </label>
              <Input
                autoComplete="off"
                autoFocus
                id="global-search-query"
                maxLength={200}
                minLength={3}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Enter at least 3 characters"
                required
                type="search"
                value={query}
              />
              <Button type="submit">Search</Button>
            </form>
            <Button
              className="w-full"
              onClick={() => setMode("scanner")}
              type="button"
              variant="outline"
            >
              <ScanQrCodeIcon aria-hidden="true" />
              Scan QR code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
