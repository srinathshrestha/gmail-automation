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

  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);
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
        throw new Error(errorMsg);
      }
      const data = await response.json();
      showToast(
        `Sync completed! Synced ${data.synced} messages (${data.created} new, ${data.updated} updated).`,
        "success"
      );
      await fetchAccountInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync");
    } finally {
      setSyncing(false);
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

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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

      {accountInfo && (
        <>
          <AccountInfo
            email={accountInfo.email}
            lastSyncedAt={accountInfo.lastSyncedAt}
            lastClassificationAt={accountInfo.lastClassificationAt}
          />
          <SyncControls
            onSync={handleSync}
            onRunSuggestions={handleRunSuggestions}
            syncing={syncing}
            runningSuggestions={runningSuggestions}
          />
          {session?.user?.id && (
            <SenderSelection userId={session.user.id} />
          )}
        </>
      )}
    </div>
  );
}

