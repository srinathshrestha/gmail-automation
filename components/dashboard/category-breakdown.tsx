// Category distribution component
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CategoryBreakdownProps {
  categories: Record<string, number>;
}

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const total = Object.values(categories).reduce((sum, count) => sum + count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Categories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(categories).map(([category, count]) => {
            const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
            return (
              <div key={category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{category}</Badge>
                </div>
                <div className="text-right">
                  <span className="font-medium">{count}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({percentage}%)
                  </span>
                </div>
              </div>
            );
          })}
          {Object.keys(categories).length === 0 && (
            <p className="text-center text-muted-foreground">No categories found</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

