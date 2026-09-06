import { useTheme } from "@/components/theme-provider"

export function ThemeSelect() {
  const { theme, setTheme } = useTheme()

  return (
    <label className="grid gap-1.5 text-label-compact text-muted-foreground">
      <span>Theme</span>
      <select
        className="h-8 rounded-md border bg-background px-2 text-foreground"
        value={theme}
        onChange={(event) => {
          const nextTheme = event.target.value
          if (
            nextTheme === "system" ||
            nextTheme === "light" ||
            nextTheme === "dark"
          ) {
            setTheme(nextTheme)
          }
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  )
}
