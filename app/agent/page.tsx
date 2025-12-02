// Agent suggestions page
"use client";

import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CandidateList } from "@/components/agent/candidate-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { showToast } from "@/components/ui/toast";
import { DeletionProgress } from "@/components/ui/deletion-progress";

interface Candidate {
  id: string;
  gmailMessageId: string;
  sender: string;
  senderName: string | null;
  subject: string;
  snippet: string;
  age: string;
  deleteScore: number | null;
  reason: string | null;
  category: string;
  hasUserReplied: boolean;
  labels: string[];
}

export default function AgentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [runningSuggestions, setRunningSuggestions] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState<{
    total: number;
    deleted: number;
    remaining: number;
    errors: number;
  } | null>(null);

  // Restore state from localStorage on mount
  useEffect(() => {
    const savedCandidates = localStorage.getItem("agentCandidates");
    const savedSelectedIds = localStorage.getItem("agentSelectedIds");
    const savedRunningStatus = localStorage.getItem("agentRunning");
    const savedDeletionProgress = localStorage.getItem("agentDeletionProgress");
    const savedDeletingStatus = localStorage.getItem("agentDeleting");

    if (savedCandidates) {
      try {
        const parsedCandidates = JSON.parse(savedCandidates);
        setCandidates(parsedCandidates);
      } catch (e) {
        console.error("Failed to parse saved candidates:", e);
      }
    }

    if (savedSelectedIds) {
      try {
        const parsedIds = JSON.parse(savedSelectedIds);
        setSelectedIds(new Set(parsedIds));
      } catch (e) {
        console.error("Failed to parse saved selected IDs:", e);
      }
    }

    if (savedRunningStatus === "true") {
      setRunningSuggestions(true);
    }

    if (savedDeletingStatus === "true") {
      setDeleting(true);
    }

    if (savedDeletionProgress) {
      try {
        const parsedProgress = JSON.parse(savedDeletionProgress);
        setDeletionProgress(parsedProgress);
      } catch (e) {
        console.error("Failed to parse saved deletion progress:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session) {
      // Only fetch if we don't have cached data
      const savedCandidates = localStorage.getItem("agentCandidates");
      if (!savedCandidates) {
      fetchCandidates();
      } else {
        setLoading(false);
      }
    }
  }, [status, session, router]);

  // Save candidates to localStorage whenever they change
  useEffect(() => {
    if (candidates.length > 0) {
      localStorage.setItem("agentCandidates", JSON.stringify(candidates));
    }
  }, [candidates]);

  // Save selectedIds to localStorage whenever they change
  useEffect(() => {
    if (selectedIds.size > 0) {
      localStorage.setItem(
        "agentSelectedIds",
        JSON.stringify(Array.from(selectedIds))
      );
    } else {
      localStorage.removeItem("agentSelectedIds");
    }
  }, [selectedIds]);

  // Save deletion progress to localStorage whenever it changes
  useEffect(() => {
    if (deletionProgress) {
      localStorage.setItem("agentDeletionProgress", JSON.stringify(deletionProgress));
    } else {
      localStorage.removeItem("agentDeletionProgress");
    }
  }, [deletionProgress]);

  // Save deleting status to localStorage
  useEffect(() => {
    if (deleting) {
      localStorage.setItem("agentDeleting", "true");
    } else {
      localStorage.removeItem("agentDeleting");
    }
  }, [deleting]);

  // Auto-select all candidates on load if none are selected
  useEffect(() => {
    const savedSelectedIds = localStorage.getItem("agentSelectedIds");
    if (candidates.length > 0 && selectedIds.size === 0 && !savedSelectedIds) {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates]);

  async function fetchCandidates() {
    try {
      setLoading(true);
      const response = await fetch("/api/agent/delete-candidates", {
        // Add cache-busting to ensure fresh data
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      // Handle 404 - no Gmail account
      if (response.status === 404) {
        setError("NO_ACCOUNT");
        setCandidates([]);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch candidates");
      }
      const data = await response.json();
      console.log("Fetched candidates:", data.candidates?.length || 0);
      
      const newCandidates = data.candidates || [];
      setCandidates(newCandidates);
      setError(null);
      
      // Save to localStorage
      if (newCandidates.length > 0) {
        localStorage.setItem("agentCandidates", JSON.stringify(newCandidates));
      }
    } catch (err) {
      console.error("Error fetching candidates:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load candidates"
      );
    } finally {
      setLoading(false);
    }
  }

  async function runSuggestions() {
    try {
      setRunningSuggestions(true);
      localStorage.setItem("agentRunning", "true");
      setError(null);
      // Show loading state while processing
      setLoading(true);

      // Check session before making request
      const sessionCheck = await fetch("/api/auth/session");
      if (!sessionCheck.ok) {
        throw new Error("Session expired. Please sign in again.");
      }

      const response = await fetch("/api/agent/suggest-deletes", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        // Check if it's an auth error
        if (response.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }
        throw new Error(data.error || "Failed to run suggestions");
      }

      const data = await response.json();
      console.log("Agent suggestions completed:", data);
      
      // Clear all cached data to ensure fresh fetch
      localStorage.removeItem("agentCandidates");
      localStorage.removeItem("agentSelectedIds");
      
      // Clear current state before fetching
      setCandidates([]);
      setSelectedIds(new Set());
      
      // Refresh candidates after running suggestions
      await fetchCandidates();
      
      showToast(
        `Evaluated ${data.evaluated} emails. Found ${data.candidates} deletion candidates.`,
        "success"
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to run suggestions";
      setError(errorMessage);
      showToast(errorMessage, "error");
      setLoading(false);

      // If session expired, redirect to login
      if (
        errorMessage.includes("Session expired") ||
        errorMessage.includes("Unauthorized")
      ) {
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } finally {
      setRunningSuggestions(false);
      localStorage.removeItem("agentRunning");
    }
  }

  async function confirmDelete() {
    if (selectedIds.size === 0) {
      showToast("Please select at least one candidate to delete", "error");
      setShowConfirmDialog(false);
      return;
    }

    try {
      setDeleting(true);
      setShowConfirmDialog(false);
      setDeletionProgress({
        total: selectedIds.size,
        deleted: 0,
        remaining: selectedIds.size,
        errors: 0,
      });

      const response = await fetch("/api/agent/confirm-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageIds: Array.from(selectedIds),
          stream: true, // Enable streaming for progress
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start deletion");
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream available");
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === "progress") {
              setDeletionProgress({
                total: data.total,
                deleted: data.deleted,
                remaining: data.remaining,
                errors: data.errors,
              });
            } else if (data.type === "complete") {
              setDeletionProgress(null);
              setSelectedIds(new Set());
              localStorage.removeItem("agentSelectedIds");
              localStorage.removeItem("agentDeletionProgress");
              localStorage.removeItem("agentDeleting");
              // Clear cached candidates to force fresh fetch
              localStorage.removeItem("agentCandidates");
              await fetchCandidates();
              showToast(
                `Successfully deleted ${data.deleted} email${
                  data.deleted !== 1 ? "s" : ""
                }.${
                  data.errors > 0
                    ? ` ${data.errors} error${
                        data.errors !== 1 ? "s" : ""
                      } occurred.`
                    : ""
                }`,
                data.errors > 0 ? "error" : "success"
              );
            } else if (data.type === "error") {
              throw new Error(data.error || "Unknown error");
            }
          } catch (parseError) {
            console.error("Error parsing stream data:", parseError);
          }
        }
      }
    } catch (err) {
      setDeletionProgress(null);
      localStorage.removeItem("agentDeletionProgress");
      localStorage.removeItem("agentDeleting");
      setError(
        err instanceof Error ? err.message : "Failed to delete messages"
      );
      showToast(
        err instanceof Error ? err.message : "Failed to delete messages",
        "error"
      );
    } finally {
      setDeleting(false);
      localStorage.removeItem("agentDeleting");
    }
  }

  function handleSelect(id: string, selected: boolean) {
    const newSelected = new Set(selectedIds);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  }

  // Select all candidates
  function handleSelectAll() {
    setSelectedIds(new Set(candidates.map((c) => c.id)));
  }

  // Deselect all candidates
  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  // Check if all candidates are selected
  const allSelected =
    candidates.length > 0 && selectedIds.size === candidates.length;

  // Show welcome message if no Gmail account connected
  if (error === "NO_ACCOUNT") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Icon name="Bot" className="h-6 w-6 sm:h-8 sm:w-8" size={32} />
            Agent Suggestions
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Review AI-suggested emails for deletion
          </p>
        </div>
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Icon
                name="Bot"
                className="h-8 w-8 text-muted-foreground"
                size={32}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">
                No Gmail Account Connected
              </h3>
              <p className="text-muted-foreground mb-6">
                Connect your Gmail account and sync emails to get AI-powered
                deletion suggestions
              </p>
              <Button onClick={() => router.push("/settings")}>
                <Icon name="Settings" className="mr-2" size={16} />
                Go to Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Always show static headers */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Icon name="Bot" className="h-6 w-6 sm:h-8 sm:w-8" size={32} />
            Agent Suggestions
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Review AI-suggested emails for deletion
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={runSuggestions}
            disabled={runningSuggestions || loading}
            variant="outline"
            className="relative overflow-hidden group"
          >
            <Icon 
              name="Sparkles" 
              className={`h-4 w-4 mr-2 ${runningSuggestions ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`}
              size={16} 
            />
            {runningSuggestions ? (
              <span className="animate-pulse">Analyzing emails...</span>
            ) : (
              "Run Suggestions"
            )}
            {runningSuggestions && (
              <span className="absolute inset-0 bg-primary/10 animate-pulse" />
            )}
          </Button>
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={selectedIds.size === 0 || deleting}
            variant="destructive"
          >
            <Icon name="Trash" className="h-4 w-4 mr-2" size={16} />
            Delete Selected ({selectedIds.size})
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {deletionProgress && (
        <DeletionProgress
          total={deletionProgress.total}
          deleted={deletionProgress.deleted}
          remaining={deletionProgress.remaining}
          errors={deletionProgress.errors}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              {/* Always show static title and description */}
              <CardTitle>
                Deletion Candidates {loading ? "" : `(${candidates.length})`}
              </CardTitle>
              <CardDescription>
                These emails have been identified as safe to delete. Review and
                select which ones to remove.
              </CardDescription>
            </div>
            {candidates.length > 0 && (
              <div className="flex gap-2">
                {allSelected ? (
                  <Button
                    onClick={handleDeselectAll}
                    variant="outline"
                    size="sm"
                  >
                    <Icon name="Square" className="h-4 w-4 mr-2" size={16} />
                    Deselect All
                  </Button>
                ) : (
                  <Button onClick={handleSelectAll} variant="outline" size="sm">
                    <Icon
                      name="CheckSquare"
                      className="h-4 w-4 mr-2"
                      size={16}
                    />
                    Select All
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <CandidateList
            candidates={loading ? null : candidates}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            loading={loading}
          />
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} email
              {selectedIds.size !== 1 ? "s" : ""}? This action cannot be undone.
              The emails will be moved to your Gmail trash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
