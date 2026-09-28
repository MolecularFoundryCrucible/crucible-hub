import type { ReactNode } from "react"

import { BrandMark } from "@/components/crucible/brand-mark"
import { SignInFailureIcon } from "@/components/crucible/icons"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function AuthPage({
  title,
  description,
  children,
  footer,
  error = false,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  error?: boolean
}) {
  return (
    <main className="auth-page">
      <div className="auth-page-frame">
        <div className="auth-page-brand">
          <BrandMark className="auth-page-mark" />
          <span className="text-brand">Crucible Hub</span>
        </div>
        <Card className="auth-page-card">
          <CardHeader className="auth-page-header">
            {error ? (
              <span className="auth-page-status" aria-hidden="true">
                <SignInFailureIcon />
              </span>
            ) : null}
            <CardTitle>
              <h1 className="text-title-page">{title}</h1>
            </CardTitle>
            {description ? (
              <CardDescription className="text-body-prominent">
                {description}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer ? (
            <CardFooter className="auth-page-footer">{footer}</CardFooter>
          ) : null}
        </Card>
      </div>
    </main>
  )
}
