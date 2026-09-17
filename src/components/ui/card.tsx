import * as React from "react"

import { cn } from "@/lib/utils"

const CardHeaderActionLayoutContext = React.createContext<
  "inline" | "responsive"
>("responsive")

function Card({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  variant?: "default" | "destructive"
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-body text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        variant === "destructive" && "bg-destructive/5 ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({
  actionLayout = "responsive",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  actionLayout?: "inline" | "responsive"
}) {
  return (
    <CardHeaderActionLayoutContext value={actionLayout}>
      <div
        data-slot="card-header"
        className={cn(
          "group/card-header @container/card-header grid auto-rows-min grid-cols-1 items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
          actionLayout === "inline"
            ? "has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]"
            : "sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]",
          className
        )}
        {...props}
      />
    </CardHeaderActionLayoutContext>
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "min-w-0 font-heading text-title-section break-words",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        "min-w-0 text-body break-words text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  const actionLayout = React.useContext(CardHeaderActionLayoutContext)

  return (
    <div
      data-slot="card-action"
      className={cn(
        actionLayout === "inline"
          ? "col-start-2 row-span-2 row-start-1 w-auto self-start justify-self-end"
          : "mt-3 w-full self-start justify-self-stretch sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:w-auto sm:justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
