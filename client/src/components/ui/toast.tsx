import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex max-h-screen w-full flex-col p-2 md:top-auto md:bottom-4 md:right-4 md:left-auto md:translate-x-0 md:flex-col-reverse md:p-4 md:max-w-[420px] max-w-[calc(100%-1rem)]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-xl border p-3 pr-8 shadow-xl backdrop-blur-md transition-all duration-300 data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full md:data-[state=closed]:slide-out-to-right-full md:data-[state=open]:slide-in-from-bottom-full hover:shadow-2xl md:p-4 md:space-x-3",
  {
    variants: {
      variant: {
        default: "border-[#707ff5]/30 bg-gradient-to-r from-[#1e1e76]/95 via-[#4b4bc3]/95 to-[#707ff5]/95 text-white shadow-[#707ff5]/20",
        success:
          "border-green-500/50 bg-gradient-to-r from-green-500/15 to-green-600/15 text-green-700 dark:text-green-400 shadow-green-500/20",
        error:
          "border-red-500/50 bg-gradient-to-r from-red-500/15 to-red-600/15 text-red-700 dark:text-red-400 shadow-red-500/20",
        warning:
          "border-yellow-500/50 bg-gradient-to-r from-yellow-500/15 to-yellow-600/15 text-yellow-800 dark:text-yellow-300 shadow-yellow-500/20",
        info:
          "border-[#707ff5]/50 bg-gradient-to-r from-[#4b4bc3]/15 to-[#a195f9]/15 text-[#707ff5] dark:text-[#a195f9] shadow-[#707ff5]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export const toastIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  default: Info,
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants> & {
      showIcon?: boolean
    }
>(({ className, variant, showIcon = true, ...props }, ref) => {
  const Icon = variant ? toastIcons[variant] : toastIcons.default
  
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {showIcon && variant && variant !== 'default' && (
        <Icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
      )}
      {props.children}
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-xs md:text-sm font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs md:text-sm opacity-90 leading-snug", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
