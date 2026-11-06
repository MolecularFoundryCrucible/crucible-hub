import orcidIdUrl from "@/assets/orcid-id.svg"

export function OrcidValue({
  orcid,
  verified,
}: {
  orcid: string
  verified: boolean | null | undefined
}) {
  const href = `https://orcid.org/${orcid}`
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body">
      <a
        className="inline-flex min-w-0 items-center gap-1.5 rounded-sm font-mono break-all underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        href={href}
        referrerPolicy="no-referrer"
        rel="noopener noreferrer"
        target="_blank"
      >
        {verified ? (
          <img
            alt=""
            aria-hidden="true"
            className="size-icon-label shrink-0"
            src={orcidIdUrl}
          />
        ) : null}
        {orcid}
        {verified ? <span className="sr-only">, verified</span> : null}
      </a>
      {verified ? null : (
        <span className="text-muted-foreground">Not verified</span>
      )}
    </span>
  )
}
