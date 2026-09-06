export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-page-section [&>*]:min-w-0">
      {children}
    </div>
  )
}
