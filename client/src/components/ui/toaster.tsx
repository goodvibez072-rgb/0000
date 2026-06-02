import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {/* Aria-live region for toast notifications - Accessibility Enhancement */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {toasts.map(({ id, title, description }) => (
          <div key={id}>
            {title && <span>{title}</span>}
            {description && <span>. {description}</span>}
          </div>
        ))}
      </div>
      
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1 flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
