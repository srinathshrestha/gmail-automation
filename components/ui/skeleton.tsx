import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

// Shimmer effect for loading states
function Shimmer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted rounded-md",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton, Shimmer }
