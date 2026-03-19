import { Skeleton } from "@/components/ui/skeleton";

interface LoadingSkeletonProps {
  type: "table" | "chart" | "card" | "list";
  rows?: number;
}

export function LoadingSkeleton({ type, rows = 5 }: LoadingSkeletonProps) {
  if (type === "table") {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex space-x-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "chart") {
    return <Skeleton className="h-64 w-full" />;
  }

  if (type === "card") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (type === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  return <Skeleton className="h-4 w-full" />;
}