// Deletion progress indicator component
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@/components/ui/icon";

interface DeletionProgressProps {
  total: number;
  deleted: number;
  remaining: number;
  errors?: number;
}

export function DeletionProgress({
  total,
  deleted,
  remaining,
  errors = 0,
}: DeletionProgressProps) {
  const progress = total > 0 ? (deleted / total) * 100 : 0;

  return (
    <Card className="border-primary">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="Loader" className="h-4 w-4 animate-spin" size={16} />
              <span className="font-semibold">Deleting emails...</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {deleted} / {total}
            </span>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                Deleted: <span className="font-medium text-foreground">{deleted}</span>
              </span>
              <span className="text-muted-foreground">
                Remaining: <span className="font-medium text-foreground">{remaining}</span>
              </span>
              {errors > 0 && (
                <span className="text-destructive">
                  Errors: <span className="font-medium">{errors}</span>
                </span>
              )}
            </div>
            <span className="text-muted-foreground">
              {progress.toFixed(0)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

