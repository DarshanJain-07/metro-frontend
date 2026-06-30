import { Skeleton } from "@/components/ui/skeleton";

export function NavbarSkeleton() {
  return (
    <div className="flex items-center gap-6 h-full w-full">
      <Skeleton className="h-9 w-9 rounded-md" />
      <Skeleton className="h-6 w-24 rounded-md" />
      <div className="ml-auto flex items-center gap-3 md:gap-5">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col items-center py-8 gap-8 w-full">
      <Skeleton className="h-10 w-10 rounded-md" />
      <div className="flex flex-col items-center gap-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-12 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-12 w-12 rounded-md mt-auto" />
    </div>
  );
}

export function ContentSkeleton() {
  return (
    <div className="flex-1 p-6 md:p-10 space-y-10 overflow-hidden animate-fade-in">
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-4 w-96 rounded-md opacity-60" />
      </div>
      
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-md" />
        ))}
      </div>

      <div className="space-y-4 pt-4">
        <Skeleton className="h-[400px] w-full rounded-md" />
      </div>
    </div>
  );
}

export function AppSkeleton() {
  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      <div 
        className="w-full h-12 bg-card flex items-center px-3 md:px-4 justify-between shrink-0 shadow-sm border-b border-border"
      >
        <NavbarSkeleton />
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div 
          className="h-full w-16 bg-card flex flex-col items-center py-6 shrink-0 border-r border-border"
        >
          <SidebarSkeleton />
        </div>
        <ContentSkeleton />
      </div>
    </div>
  );
}
