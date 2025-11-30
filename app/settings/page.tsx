// Settings page
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountInfo } from "@/components/settings/account-info";
import { SyncControls } from "@/components/settings/sync-controls";
import { SenderSelection } from "@/components/settings/sender-selection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/components/ui/toast";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [accountInfo, setAccountInfo] = useState<{
    email: string;
    lastSyncedAt: string | null;
    lastClassificationAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [runningSuggestions, setRunningSuggestions] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    status: string;
    processedMessages: number;
    totalMessages: number;
    created: number;
    updated: number;
    errors: number;
    progress: number;
    hasMore: boolean;
  } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session) {
      fetchAccountInfo();
    }
  }, [status, session, router]);

  async function fetchAccountInfo() {
    try {
      setLoading(true);
      const response = await fetch("/api/settings/account");
      if (!response.ok) {
        throw new Error("Failed to fetch account info");
      }
      const data = await response.json();
      setAccountInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account info");
    } finally {
      setLoading(false);
    }
  }

  // Poll for sync progress when syncing
  useEffect(() => {
    if (!syncing) return;

    let pollTimeout: NodeJS.Timeout;
    let isCancelled = false;

    async function pollSyncProgress() {
      if (isCancelled) return;

      try {
        const response = await fetch("/api/gmail/sync");
        if (response.ok) {
          const data = await response.json();
          if (data.status && data.status !== "idle") {
            setSyncProgress({
              status: data.status,
              processedMessages: data.processedMessages || 0,
              totalMessages: data.totalMessages || 0,
              created: data.created || 0,
              updated: data.updated || 0,
              errors: data.errors || 0,
              progress: data.progress || 0,
              hasMore: data.hasMore || false,
            });

            // If sync is in progress or timed out, continue polling and resume if needed
            if (data.status === "in_progress" || data.status === "timeout") {
              // Continue syncing if there's more to process
              if (data.hasMore || data.status === "timeout") {
                // Automatically resume sync
                setTimeout(async () => {
                  if (!isCancelled) {
                    try {
                      await fetch("/api/gmail/sync", { method: "POST" });
                    } catch (err) {
                      console.error("Error resuming sync:", err);
                    }
                  }
                }, 1000);
              }
              // Poll again in 2 seconds
              pollTimeout = setTimeout(pollSyncProgress, 2000);
            } else if (data.status === "completed") {
              // Sync completed
              setSyncing(false);
              showToast(
                `Sync completed! Synced ${data.processedMessages} messages (${data.created} new, ${data.updated} updated).`,
                "success"
              );
              await fetchAccountInfo();
              setSyncProgress(null);
            } else if (data.status === "failed") {
              // Sync failed
              setSyncing(false);
              setError(data.errorMessage || "Sync failed");
              setSyncProgress(null);
            }
          } else {
            // No active sync
            setSyncProgress(null);
          }
        }
      } catch (err) {
        console.error("Error polling sync progress:", err);
        // Continue polling even on error (might be temporary)
        if (syncing && !isCancelled) {
          pollTimeout = setTimeout(pollSyncProgress, 2000);
        }
      }
    }

    // Start polling
    pollTimeout = setTimeout(pollSyncProgress, 2000);

    // Cleanup function
    return () => {
      isCancelled = true;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    };
  }, [syncing]);

  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);
      setSyncProgress(null);

      const response = await fetch("/api/gmail/sync", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        // Build detailed error message
        let errorMsg = data.error || "Failed to sync";
        if (data.details) {
          errorMsg += `: ${data.details}`;
        }
        if (data.hint) {
          errorMsg += `\n\n${data.hint}`;
        }
        if (data.enableUrl) {
          errorMsg += `\n\nEnable URL: ${data.enableUrl}`;
        }
        if (data.instructions && Array.isArray(data.instructions)) {
          errorMsg += `\n\n${data.instructions.join("\n")}`;
        }

        // Check if it's a timeout error that can be resumed
        if (data.canResume) {
          errorMsg += "\n\nThe sync will automatically resume. Progress is being tracked.";
          // Keep syncing=true so useEffect continues polling
        } else {
          setSyncing(false);
          throw new Error(errorMsg);
        }
      } else {
        const data = await response.json();

        // If sync completed immediately (no more messages)
        if (data.message === "Sync completed" && !data.hasMore) {
          setSyncing(false);
          showToast(
            `Sync completed! Synced ${data.synced} messages (${data.created} new, ${data.updated} updated).`,
            "success"
          );
          await fetchAccountInfo();
          setSyncProgress(null);
        }
        // Otherwise, sync is in progress - useEffect will handle polling
      }
    } catch (err) {
      setSyncing(false);
      setError(err instanceof Error ? err.message : "Failed to sync");
      setSyncProgress(null);
    }
  }

  async function handleRunSuggestions() {
    try {
      setRunningSuggestions(true);
      setError(null);
      const response = await fetch("/api/agent/suggest-deletes", {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to run suggestions");
      }
      const data = await response.json();
      showToast(
        `Evaluated ${data.evaluated} emails. Found ${data.candidates} deletion candidates.`,
        "success"
      );
      await fetchAccountInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run suggestions");
    } finally {
      setRunningSuggestions(false);
    }
  }

  // Don't show full skeleton - keep static content visible

  if (error && !accountInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Always show static headers */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Icon name="Settings" className="h-6 w-6 sm:h-8 sm:w-8" size={32} />
          Settings
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Manage your account and sync settings
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Icon name="Shield" className="h-5 w-5" size={20} />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-md font-sans">
                {error}
              </pre>
              {error.includes("Gmail API") && error.includes("not enabled") && (
                <div className="mt-4 p-4 bg-muted rounded-md">
                  <p className="font-semibold mb-2">Quick Fix:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to <a href="https://console.developers.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console - Gmail API</a></li>
                    <li>Select your project</li>
                    <li>Click &quot;Enable&quot;</li>
                    <li>Wait 2-3 minutes for changes to propagate</li>
                    <li>Try syncing again</li>
                  </ol>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Always show AccountInfo card with static headers, only skeleton the data */}
      <AccountInfo
        email={accountInfo?.email || null}
        lastSyncedAt={accountInfo?.lastSyncedAt || null}
        lastClassificationAt={accountInfo?.lastClassificationAt || null}
        loading={loading}
      />
      
      {/* Always show SyncControls and SenderSelection */}
      <SyncControls
        onSync={handleSync}
        onRunSuggestions={handleRunSuggestions}
        syncing={syncing}
        runningSuggestions={runningSuggestions}
        syncProgress={syncProgress}
      />
      {session?.user?.id && (
        <SenderSelection userId={session.user.id} />
      )}
    </div>
  );
}

