import { useEffect, useRef, useState } from "react"

import { CloseIcon, SearchIcon } from "@/components/crucible/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

const directorySearchDebounceMs = 250
const directorySearchMinLength = 3

export function DirectorySearchField({
  label,
  onSearch,
  placeholder,
  query,
}: {
  label: string
  onSearch: (query: string | undefined) => void
  placeholder: string
  query?: string
}) {
  const [value, setValue] = useState(query ?? "")
  const inputRef = useRef<HTMLInputElement>(null)
  const lastCommittedRef = useRef<string | undefined>(query)
  const debouncedValue = useDebouncedValue(value, directorySearchDebounceMs)

  useEffect(() => {
    if ((query ?? null) === (lastCommittedRef.current ?? null)) return
    lastCommittedRef.current = query
    setValue(query ?? "")
  }, [query])

  useEffect(() => {
    commit(debouncedValue)
  }, [debouncedValue])

  function commit(next: string) {
    const trimmed = next.trim()
    const search =
      trimmed.length >= directorySearchMinLength ? trimmed : undefined
    if ((search ?? null) === (lastCommittedRef.current ?? null)) return
    lastCommittedRef.current = search
    onSearch(search)
  }

  function clear() {
    setValue("")
    commit("")
    inputRef.current?.focus()
  }

  return (
    <InputGroup className="max-w-reading">
      <InputGroupAddon align="inline-start">
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={label}
        autoComplete="off"
        className="[&::-webkit-search-cancel-button]:hidden"
        maxLength={200}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit(value)
          }
        }}
        placeholder={placeholder}
        ref={inputRef}
        type="search"
        value={value}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Clear search" onClick={clear}>
            <CloseIcon aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
