import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormLoadingStateProps {
  message?: string;
  className?: string;
}

export function FormLoadingState({ 
  message = "Processing...", 
  className 
}: FormLoadingStateProps) {
  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{message}</span>
    </div>
  );
}

// Overlay loading state for forms
export function FormLoadingOverlay({ message = "Saving..." }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}
