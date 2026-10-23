import { useTheme } from "@/components/theme-provider"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

export function ThemeSelect() {
  const { theme, setTheme } = useTheme()

  return (
    <label className="grid gap-1.5 text-label-compact text-muted-foreground">
      <span>Theme</span>
      <NativeSelect
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
        <NativeSelectOption value="system">System</NativeSelectOption>
        <NativeSelectOption value="light">Light</NativeSelectOption>
        <NativeSelectOption value="dark">Dark</NativeSelectOption>
      </NativeSelect>
    </label>
  )
}
