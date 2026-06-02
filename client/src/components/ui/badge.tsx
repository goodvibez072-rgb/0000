import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Whitespace-nowrap: Badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2" +
  " hover-elevate " ,
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-purple-500/30 hover:shadow-lg hover:shadow-purple-500/40",
        secondary: "border-transparent bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm hover:shadow-md",
        destructive:
          "border-transparent bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-md shadow-red-500/30 hover:shadow-lg hover:shadow-red-500/40",
        success:
          "border-transparent bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/40",
        warning:
          "border-transparent bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30 hover:shadow-lg hover:shadow-amber-500/40",
        info:
          "border-transparent bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40",
        pink:
          "border-transparent bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/30 hover:shadow-lg hover:shadow-pink-500/40",
        outline: " border-2 border-primary/50 bg-primary/10 text-primary shadow-sm shadow-primary/10 hover:bg-primary/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
