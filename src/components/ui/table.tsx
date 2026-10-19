import * as React from "react"

import { cn } from "@/lib/utils"

function Table({
  before,
  className,
  ...props
}: React.ComponentProps<"table"> & { before?: React.ReactNode }) {
  return (
    <div
      data-slot="table-container"
      className="@container relative w-full overflow-x-auto"
    >
      {before}
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-body", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 text-label [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 has-[[aria-current=true]]:bg-muted data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

const tableColumnKinds = {
  text: "text-left",
  numeric: "text-right tabular-nums",
  date: "text-left tabular-nums",
  action: "text-right",
  select: "text-center",
} as const

type TableColumnKind = keyof typeof tableColumnKinds

type TableColumnProps = { kind?: TableColumnKind }

function TableHead({
  className,
  kind = "text",
  ...props
}: React.ComponentProps<"th"> & TableColumnProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 align-middle text-label whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        tableColumnKinds[kind],
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  kind = "text",
  ...props
}: React.ComponentProps<"td"> & TableColumnProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        tableColumnKinds[kind],
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-body text-muted-foreground", className)}
      {...props}
    />
  )
}

export type { TableColumnKind }
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
