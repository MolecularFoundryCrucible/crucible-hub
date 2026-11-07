import { lazy } from "react"
import type { ComponentType, LazyExoticComponent } from "react"

type PropsOf<TComponent> =
  TComponent extends ComponentType<infer TProps> ? TProps : never

type NamedComponents<TModule> = {
  [TName in keyof TModule]: [PropsOf<TModule[TName]>] extends [never]
    ? never
    : TName
}[keyof TModule]

type LazyNamed<TComponent> = LazyExoticComponent<
  ComponentType<PropsOf<TComponent>>
> & { preload: () => Promise<unknown> }

export function lazyNamed<TModule, TName extends NamedComponents<TModule>>(
  importer: () => Promise<TModule>,
  name: TName
): LazyNamed<TModule[TName]> {
  type Loaded = { default: ComponentType<object> }
  let loading: Promise<Loaded> | undefined
  const load = () =>
    (loading ??= importer().then(
      (module) => ({ default: module[name] as ComponentType<object> }),
      (error: unknown) => {
        loading = undefined
        throw error
      }
    ))
  return Object.assign(lazy(load), { preload: load }) as LazyNamed<
    TModule[TName]
  >
}
