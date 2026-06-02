import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-gradient-to-r from-muted via-muted/80 to-muted", className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-[#707ff5]/10 to-transparent" />
    </div>
  )
}

export { Skeleton }
