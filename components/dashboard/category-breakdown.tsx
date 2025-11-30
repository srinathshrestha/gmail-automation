// Category distribution component
// Always shows static title, only skeletons the data
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CategoryBreakdownProps {
  categories: Record<string, number> | null;
  loading?: boolean;
}

export function CategoryBreakdown({ categories, loading }: CategoryBreakdownProps) {
  const total = categories ? Object.values(categories).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <Card>
      <CardHeader>
        {/* Always show static title */}
        <CardTitle className="text-base sm:text-lg">Email Categories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {loading || categories === null ? (
            // Show skeleton rows for data only
            [...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-5 sm:h-6 w-20 sm:w-24" />
                <Skeleton className="h-4 w-12 sm:w-16" />
              </div>
            ))
          ) : Object.keys(categories).length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">No categories found</p>
          ) : (
            Object.entries(categories).map(([category, count]) => {
              const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
              return (
                <div key={category} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-xs whitespace-nowrap">{category}</Badge>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-medium text-sm sm:text-base tabular-nums">{count}</span>
                    <span className="text-[10px] sm:text-sm text-muted-foreground ml-1 sm:ml-2">
                      ({percentage}%)
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

