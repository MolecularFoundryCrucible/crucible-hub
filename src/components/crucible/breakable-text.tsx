import { Fragment } from "react"

const breakOpportunity = /^[_./+-]+$/

export function BreakableText({ value }: { value: string }) {
  const parts = value.split(/([_./+-]+)/)

  return parts.map((part, index) => (
    <Fragment key={`${index}:${part}`}>
      {part}
      {breakOpportunity.test(part) ? <wbr /> : null}
    </Fragment>
  ))
}
