import orcidIdUrl from "@/assets/orcid-id.svg"

export function OrcidValue({
  orcid,
  plain = false,
  verified,
}: {
  orcid: string
  plain?: boolean
  verified: boolean | null | undefined
}) {
  const href = `https://orcid.org/${orcid}`
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body">
      <a
        aria-label={verified && !plain ? `${orcid}, verified` : undefined}
        className="inline-flex min-w-0 items-center gap-1.5 rounded-sm font-mono break-words underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        href={href}
        referrerPolicy="no-referrer"
        rel="noopener noreferrer"
        target="_blank"
      >
        {verified && !plain ? (
          <img
            alt=""
            aria-hidden="true"
            className="size-icon-label shrink-0"
            src={orcidIdUrl}
          />
        ) : null}
        {orcid}
      </a>
      {verified || plain ? null : (
        <span className="text-muted-foreground">Not verified</span>
      )}
    </span>
  )
}
