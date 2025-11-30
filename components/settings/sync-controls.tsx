// Sync controls component
// Shows sync button with fancy real-time progress tracking
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface SyncControlsProps {
  onSync: () => Promise<void>;
  syncing: boolean;
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
  syncing,
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
        <CardTitle>Sync Gmail</CardTitle>
        <CardDescription>Sync your Gmail messages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button
            onClick={onSync}
            disabled={syncing}
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

          {/* Fancy progress display */}
          {showProgress && syncProgress && (
            <div className="space-y-3 pt-3 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Status header with icon */}
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <Icon 
                    name="Download" 
                    className="h-4 w-4 text-primary animate-pulse" 
                    size={16} 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Processing messages
                    </span>
                    <span className="text-sm font-semibold text-primary tabular-nums">
                      <AnimatedCounter value={syncProgress.processedMessages} className="inline" /> / {syncProgress.totalMessages || "..."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Enhanced progress bar with gradient */}
              <div className="space-y-2">
                <div className="relative">
                  <Progress 
                    value={syncProgress.progress || 0} 
                    className="h-3 bg-secondary/50" 
                  />
                  {/* Percentage badge on progress bar */}
                  <div 
                    className="absolute top-0 right-0 h-3 flex items-center pr-1"
                    style={{ 
                      left: `${Math.max(0, Math.min(syncProgress.progress || 0, 100))}%`,
                      transition: 'left 0.3s ease-out'
                    }}
                  >
                    <span className="text-[10px] font-bold text-primary-foreground drop-shadow-md">
                      {Math.round(syncProgress.progress || 0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-2">
                {/* New messages */}
                <div className="flex flex-col items-center justify-center rounded-lg bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 p-2 transition-all hover:scale-105">
                  <div className="flex items-center gap-1">
                    <Icon name="Plus" className="h-3 w-3 text-green-600 dark:text-green-400" size={12} />
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">
                      New
                    </span>
                  </div>
                  <AnimatedCounter 
                    value={syncProgress.created}
                    className="text-lg font-bold text-green-700 dark:text-green-300 leading-none mt-1 tabular-nums"
                    duration={400}
                  />
                </div>

                {/* Updated messages */}
                <div className="flex flex-col items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 p-2 transition-all hover:scale-105">
                  <div className="flex items-center gap-1">
                    <Icon name="RefreshCw" className="h-3 w-3 text-blue-600 dark:text-blue-400" size={12} />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      Updated
                    </span>
                  </div>
                  <AnimatedCounter 
                    value={syncProgress.updated}
                    className="text-lg font-bold text-blue-700 dark:text-blue-300 leading-none mt-1 tabular-nums"
                    duration={400}
                  />
                </div>

                {/* Errors */}
                <div className={`flex flex-col items-center justify-center rounded-lg p-2 transition-all ${
                  syncProgress.errors > 0 
                    ? 'bg-red-500/10 dark:bg-red-500/20 border border-red-500/20 hover:scale-105' 
                    : 'bg-gray-500/10 dark:bg-gray-500/20 border border-gray-500/20'
                }`}>
                  <div className="flex items-center gap-1">
                    <Icon 
                      name={syncProgress.errors > 0 ? "AlertCircle" : "CheckCircle"} 
                      className={`h-3 w-3 ${
                        syncProgress.errors > 0 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-gray-600 dark:text-gray-400'
                      }`} 
                      size={12} 
                    />
                    <span className={`text-xs font-medium ${
                      syncProgress.errors > 0 
                        ? 'text-red-700 dark:text-red-300' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      Errors
                    </span>
                  </div>
                  <AnimatedCounter 
                    value={syncProgress.errors}
                    className={`text-lg font-bold leading-none mt-1 tabular-nums ${
                      syncProgress.errors > 0 
                        ? 'text-red-700 dark:text-red-300' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                    duration={400}
                  />
                </div>
              </div>

              {/* Status messages */}
              {syncProgress.hasMore && (
                <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-2.5 animate-pulse">
                  <Icon name="Info" className="h-4 w-4 text-primary shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    More messages to process - sync will continue automatically
                  </p>
                </div>
              )}
              
              {syncProgress.status === "timeout" && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
                  <Icon name="Clock" className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    Sync timed out - will resume automatically
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
