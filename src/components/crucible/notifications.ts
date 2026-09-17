import { toast } from "@/components/ui/toast"

export function notifySuccess(title: string, description?: string) {
  return toast.add({ description, priority: "low", title, type: "success" })
}
