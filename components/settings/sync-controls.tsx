// Sync controls component
// Shows sync button with real-time progress tracking
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";

interface SyncControlsProps {
  onSync: () => Promise<void>;
  onRunSuggestions: () => Promise<void>;
  syncing: boolean;
  runningSuggestions: boolean;
  syncProgress?: {
    status: string;
    processedMessages: number;
    totalMessages: number;
    created: number;
    updated: number;
    errors: number;
    progress: number;
    hasMore: boolean;
  } | null;
}

export function SyncControls({
  onSync,
  onRunSuggestions,
  syncing,
  runningSuggestions,
  syncProgress,
}: SyncControlsProps) {
  // Show progress if syncing or if there's active progress
  const showProgress =
    syncing ||
    (syncProgress &&
      (syncProgress.status === "in_progress" || syncProgress.status === "timeout"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Manual sync and classification</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button
            onClick={onSync}
            disabled={syncing || runningSuggestions}
            className="w-full"
          >
            {syncing ? (
              <>
                <Icon name="Loader" className="h-4 w-4 mr-2 animate-spin" size={16} />
                Syncing...
              </>
            ) : (
              <>
                <Icon name="Refresh" className="h-4 w-4 mr-2" size={16} />
                Sync Now
              </>
            )}
          </Button>

          {/* Progress bar and status */}
          {showProgress && syncProgress && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Processing messages...
                </span>
                <span className="font-medium">
                  {syncProgress.processedMessages} / {syncProgress.totalMessages || "?"}
                </span>
              </div>
              <Progress value={syncProgress.progress || 0} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {syncProgress.created} new, {syncProgress.updated} updated
                  {syncProgress.errors > 0 && `, ${syncProgress.errors} errors`}
                </span>
                <span>{syncProgress.progress || 0}%</span>
              </div>
              {syncProgress.hasMore && (
                <p className="text-xs text-muted-foreground">
                  More messages to process - sync will continue automatically
                </p>
              )}
              {syncProgress.status === "timeout" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Sync timed out - will resume automatically
                </p>
              )}
            </div>
          )}
        </div>

        <Button
          onClick={onRunSuggestions}
          disabled={syncing || runningSuggestions}
          variant="outline"
          className="w-full"
        >
          {runningSuggestions ? (
            <>
              <Icon name="Loader" className="h-4 w-4 mr-2 animate-spin" size={16} />
              Running...
            </>
          ) : (
            <>
              <Icon name="Sparkles" className="h-4 w-4 mr-2" size={16} />
              Run Agent Suggestions
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
