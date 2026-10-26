import { useWindowClass } from "@/hooks/use-window-class"

export function useIsMobile() {
  return useWindowClass() === "compact"
}
