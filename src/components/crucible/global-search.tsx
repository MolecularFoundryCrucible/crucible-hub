import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { SearchIcon } from "lucide-react"

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

export function GlobalSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLocaleLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedQuery = query.trim()
    if (normalizedQuery.length < 3) return
    setOpen(false)
    void navigate({
      to: "/search",
      search: { kind: undefined, q: normalizedQuery },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            className="min-w-0 flex-1 justify-start text-muted-foreground sm:max-w-sm"
            variant="outline"
          />
        }
      >
        <SearchIcon aria-hidden="true" />
        <span className="truncate">Search Crucible</span>
        <kbd
          className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-label-compact sm:inline"
          aria-hidden="true"
        >
          Ctrl K
        </kbd>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Search Crucible</DialogTitle>
          <DialogDescription>
            Find projects, instruments, samples, and datasets by name or enter a
            complete MFID.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  )
}
