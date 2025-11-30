// Sync controls component
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface SyncControlsProps {
  onSync: () => Promise<void>;
  onRunSuggestions: () => Promise<void>;
  syncing: boolean;
  runningSuggestions: boolean;
}

export function SyncControls({
  onSync,
  onRunSuggestions,
  syncing,
  runningSuggestions,
}: SyncControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Manual sync and classification</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
