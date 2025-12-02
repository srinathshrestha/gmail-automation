// Settings page
"use client";

import { useSession } from "@/lib/use-session";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { AccountInfo } from "@/components/settings/account-info";
import { AccountList } from "@/components/settings/account-list";
import { SyncControls } from "@/components/settings/sync-controls";
import { SenderSelection } from "@/components/settings/sender-selection";
import { UserProfile } from "@/components/settings/user-profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { showToast } from "@/components/ui/toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

function SettingsPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accountInfo, setAccountInfo] = useState<{
    accounts: Array<{
      id: string;
      emailAddress: string;
      isActive: boolean;
    }>;
    activeAccount: {
      id: string;
      emailAddress: string;
    } | null;
    lastSyncedAt: string | null;
    lastClassificationAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Restore sync state from localStorage on mount
  useEffect(() => {
    const savedSyncStatus = localStorage.getItem("syncInProgress");
    const savedSyncProgress = localStorage.getItem("syncProgress");

    if (savedSyncStatus === "true") {
      setSyncing(true);
    }

    if (savedSyncProgress) {
      try {
        const parsedProgress = JSON.parse(savedSyncProgress);
        setSyncProgress(parsedProgress);
      } catch (e) {
        console.error("Failed to parse saved sync progress:", e);
      }
    }
  }, []);

  // Save sync progress to localStorage whenever it changes
  useEffect(() => {
    if (syncProgress) {
      localStorage.setItem("syncProgress", JSON.stringify(syncProgress));
    } else {
      localStorage.removeItem("syncProgress");
    }
  }, [syncProgress]);

  // Handle OAuth callback messages (success or error)
  useEffect(() => {
    // Check for success message
    const connected = searchParams.get("connected");
    const email = searchParams.get("email");
    if (connected === "true" && email) {
      showToast(`Successfully connected ${email}`, "success");
      // Clean up URL
      router.replace("/settings");
    }

    // Check for error messages
    const error = searchParams.get("error");
    if (error) {
      let errorMessage = "Failed to connect Gmail account";
      
      // Provide specific error messages
      if (error === "no_tokens") {
        errorMessage = "Google didn't provide necessary tokens. Try revoking app access from your Google Account settings and reconnecting.";
      } else if (error === "oauth_failed") {
        errorMessage = "OAuth authorization failed. Please try again.";
      } else if (error === "invalid_state") {
        errorMessage = "Invalid OAuth state. Please try again.";
      } else if (error === "session_expired") {
        errorMessage = "Your session expired. Please log in again.";
      } else if (error === "no_email") {
        errorMessage = "Couldn't get email from Google account.";
      } else if (error === "oauth_callback_failed") {
        errorMessage = "OAuth callback failed. Check console for details.";
      } else if (error.startsWith("google_oauth_")) {
        // Google returned an error
        const googleError = error.replace("google_oauth_", "");
        errorMessage = `Google OAuth error: ${googleError}`;
      }
      
      showToast(errorMessage, "error");
      // Clean up URL
      router.replace("/settings");
    }
  }, [searchParams, router]);

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
              // Sync completed - wait a bit for animations to finish before showing toast
              setSyncing(false);
              localStorage.removeItem("syncInProgress");
              
              // Give the animated counters time to finish their animation (400ms + 100ms buffer)
              setTimeout(() => {
              showToast(
                `Sync completed! Synced ${data.processedMessages} messages (${data.created} new, ${data.updated} updated).`,
                "success"
              );
              }, 500);
              
              await fetchAccountInfo();
              
              // Clear progress after a short delay to let users see the final numbers
              setTimeout(() => {
              setSyncProgress(null);
                localStorage.removeItem("syncProgress");
              }, 1500);
            } else if (data.status === "failed") {
              // Sync failed
              setSyncing(false);
              localStorage.removeItem("syncInProgress");
              setError(data.errorMessage || "Sync failed");
              setSyncProgress(null);
              localStorage.removeItem("syncProgress");
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
      localStorage.setItem("syncInProgress", "true");
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
          localStorage.removeItem("syncInProgress");
          throw new Error(errorMsg);
        }
      } else {
        const data = await response.json();

        // If sync completed immediately (no more messages)
        if (data.message === "Sync completed" && !data.hasMore) {
          // Don't show toast here - let the polling mechanism handle it
          // This ensures toast only appears after all progress updates are complete
          // The useEffect will poll once more and show the completion toast
        }
        // Otherwise, sync is in progress - useEffect will handle polling
      }
    } catch (err) {
      setSyncing(false);
      localStorage.removeItem("syncInProgress");
      setError(err instanceof Error ? err.message : "Failed to sync");
      setSyncProgress(null);
      localStorage.removeItem("syncProgress");
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      showToast("Logged out successfully", "success");
      router.push("/login");
      router.refresh();
    } catch (err) {
      showToast("Failed to logout", "error");
    }
  }

  async function handleDeleteAccount() {
    try {
      setDeletingAccount(true);
      const response = await fetch("/api/user/delete-data", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete account");
      }

      showToast("Account deleted successfully", "success");
      
      // Logout and redirect
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/register");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete account",
        "error"
      );
    } finally {
      setDeletingAccount(false);
      setShowDeleteDialog(false);
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

      {/* User Profile Section */}
      {session?.user && (
        <UserProfile
          user={{
            id: session.user.id,
            username: session.user.username,
            email: session.user.email,
          }}
          onUpdate={fetchAccountInfo}
        />
      )}

      {/* Account management */}
      <AccountList />

      {/* Account info for active account */}
      <AccountInfo
        email={accountInfo?.activeAccount?.emailAddress || null}
        lastSyncedAt={accountInfo?.lastSyncedAt || null}
        lastClassificationAt={accountInfo?.lastClassificationAt || null}
        loading={loading}
      />
      
      {/* Always show SyncControls and SenderSelection */}
      <SyncControls
        onSync={handleSync}
        syncing={syncing}
        syncProgress={syncProgress}
      />
      {session?.user?.id && (
        <SenderSelection userId={session.user.id} />
      )}

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <Icon name="AlertTriangle" className="h-5 w-5" size={20} />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <h4 className="font-medium">Logout</h4>
              <p className="text-sm text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <Icon name="LogOut" className="mr-2" size={16} />
              Logout
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/50 bg-destructive/5">
            <div>
              <h4 className="font-medium text-destructive">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Icon name="Trash" className="mr-2" size={16} />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Account"
        description="Are you absolutely sure? This will permanently delete your account, all connected Gmail accounts, synced messages, and all data. This action cannot be undone."
        confirmText="Delete Everything"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteAccount}
        loading={deletingAccount}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <SettingsPageContent />
    </Suspense>
  );
}

