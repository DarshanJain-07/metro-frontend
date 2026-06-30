import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Loader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={cn("h-8 w-8 rounded-md", className)}
      {...props}
    />
  );
}

export function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <Loader className="scale-150" />
    </div>
  );
}
