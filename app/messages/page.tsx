// Messages explorer page
"use client";

import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { MessageTable } from "@/components/messages/message-table";
import { MessageFilters } from "@/components/messages/message-filters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { showToast } from "@/components/ui/toast";
import { DeletionProgress } from "@/components/ui/deletion-progress";

interface Message {
  id: string;
  sender: string;
  senderName: string | null;
  subject: string;
  snippet: string;
  internalDate: string;
  labels: string[];
  aiCategory: string;
  aiDeleteScore: number | null;
  hasUserReplied: boolean;
  isDeleteCandidate: boolean;
  isDeletedByApp: boolean;
  isManuallyKept: boolean;
}

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [senderFilter, setSenderFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [showOnlyCandidates, setShowOnlyCandidates] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState<{
    total: number;
    deleted: number;
    remaining: number;
    errors: number;
  } | null>(null);
  
  // Available filter options
  const [senders, setSenders] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Cache management
  const cacheRef = useRef<{ data: Message[]; timestamp: number } | null>(null);
  const fetchInProgressRef = useRef(false);
  const CACHE_DURATION = 30 * 1000; // 30 seconds

  // Load cached data from localStorage on mount for instant display
  useEffect(() => {
    const cachedMessages = localStorage.getItem("messagesCache");
    
    if (cachedMessages) {
      try {
        const { data, timestamp, filters } = JSON.parse(cachedMessages);
        // Check if cached filters match current filters
        if (
          filters.sender === senderFilter &&
          filters.category === categoryFilter &&
          filters.read === readFilter &&
          filters.candidates === showOnlyCandidates
        ) {
          setMessages(data);
          cacheRef.current = { data, timestamp };
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse cached messages:", e);
      }
    }

    const cachedFilterOptions = localStorage.getItem("messagesFilterOptions");
    if (cachedFilterOptions) {
      try {
        const { senders: cachedSenders, categories: cachedCategories } = JSON.parse(cachedFilterOptions);
        setSenders(cachedSenders);
        setCategories(cachedCategories);
      } catch (e) {
        console.error("Failed to parse cached filter options:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session) {
      // Fetch in background even if we have cached data
      fetchMessages(messages.length > 0); // Silent if we have data
      fetchFilterOptions();
    }
  }, [status, session, router, senderFilter, categoryFilter, readFilter, showOnlyCandidates]);

  // Handle visibility change (tab switching) - prevent unnecessary reloads
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && status === "authenticated") {
        const now = Date.now();
        // Only refetch if cache is stale
        if (
          !cacheRef.current ||
          now - cacheRef.current.timestamp > CACHE_DURATION
        ) {
          fetchMessages(true); // Silent refresh
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [status, senderFilter, categoryFilter, readFilter, showOnlyCandidates]);

  async function fetchMessages(silent = false) {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) return;

    try {
      // Only show loading if we don't have any messages yet
      if (!silent && messages.length === 0) {
        setLoading(true);
      }
      fetchInProgressRef.current = true;

      const params = new URLSearchParams();
      if (senderFilter !== "all") params.append("sender", senderFilter);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (readFilter !== "all") params.append("readStatus", readFilter);
      if (showOnlyCandidates) params.append("candidatesOnly", "true");

      const response = await fetch(`/api/messages?${params.toString()}`, {
        next: { revalidate: 30 },
      });
      
      // Handle 404 - no Gmail account
      if (response.status === 404) {
        setError("NO_ACCOUNT");
        setMessages([]);
        cacheRef.current = null;
        return;
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      
      const data = await response.json();
      const messagesData = data.messages || [];
      const now = Date.now();
      
      // Update cache
      cacheRef.current = {
        data: messagesData,
        timestamp: now,
      };

      // Save to localStorage for instant load next time
      localStorage.setItem("messagesCache", JSON.stringify({
        data: messagesData,
        timestamp: now,
        filters: {
          sender: senderFilter,
          category: categoryFilter,
          read: readFilter,
          candidates: showOnlyCandidates,
        }
      }));
      
      setMessages(messagesData);
      setError(null);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      fetchInProgressRef.current = false;
    }
  }


  function handleDeleteClick() {
    if (selectedIds.size === 0) {
      showToast("Please select messages to delete", "error");
      return;
    }
    setShowDeleteDialog(true);
  }

  async function handleDeleteConfirmed() {
    try {
      setDeleting(true);
      setError(null);
      setShowDeleteDialog(false);
      setDeletionProgress({
        total: selectedIds.size,
        deleted: 0,
        remaining: selectedIds.size,
        errors: 0,
      });
      
      const response = await fetch("/api/messages/delete", {
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
              const successMessage = `Successfully deleted ${data.deleted} message${data.deleted !== 1 ? "s" : ""}.${data.errors > 0 ? ` ${data.errors} error${data.errors !== 1 ? "s" : ""} occurred.` : ""}`;
              showToast(successMessage, data.errors > 0 ? "error" : "success");
              
              // Clear selection and refresh
              setSelectedIds(new Set());
              await fetchMessages();
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
      setError(err instanceof Error ? err.message : "Failed to delete messages");
      showToast(err instanceof Error ? err.message : "Failed to delete messages", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function fetchFilterOptions() {
    try {
      const response = await fetch("/api/messages/filters");
      if (response.ok) {
        const data = await response.json();
        setSenders(data.senders || []);
        setCategories(data.categories || []);

        // Save to localStorage
        localStorage.setItem("messagesFilterOptions", JSON.stringify({
          senders: data.senders || [],
          categories: data.categories || [],
        }));
      }
    } catch (err) {
      console.error("Failed to fetch filter options:", err);
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

  function handleSelectAll(selected: boolean) {
    if (selected && messages) {
      setSelectedIds(new Set(messages.map((m) => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  // Show welcome message if no Gmail account connected
  if (error === "NO_ACCOUNT") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Icon name="Message" className="h-6 w-6 sm:h-8 sm:w-8" size={32} />
            Messages
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Browse and manage your synced emails
          </p>
        </div>
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Icon name="Mail" className="h-8 w-8 text-muted-foreground" size={32} />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">No Gmail Account Connected</h3>
              <p className="text-muted-foreground mb-6">
                Connect your Gmail account to view and manage your messages
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
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Icon name="Message" className="h-6 w-6 sm:h-8 sm:w-8" size={32} />
          Messages
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Browse and manage your synced emails
        </p>
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
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter messages by sender, category, or status</CardDescription>
        </CardHeader>
        <CardContent>
          <MessageFilters
            senderFilter={senderFilter}
            categoryFilter={categoryFilter}
            readFilter={readFilter}
            showOnlyCandidates={showOnlyCandidates}
            onSenderChange={setSenderFilter}
            onCategoryChange={setCategoryFilter}
            onReadChange={setReadFilter}
            onCandidatesChange={setShowOnlyCandidates}
            senders={senders}
            categories={categories}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Messages {loading ? "" : `(${messages.length})`}
              {selectedIds.size > 0 && ` - ${selectedIds.size} selected`}
            </CardTitle>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteClick}
                disabled={deleting}
              >
                <Icon name="Trash" className="h-4 w-4 mr-2" size={16} />
                Delete Selected ({selectedIds.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <MessageTable
            messages={loading ? null : messages}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            loading={loading}
          />
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Messages"
        description={`Are you sure you want to delete ${selectedIds.size} message(s)? This action cannot be undone. The emails will be moved to your Gmail trash.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirmed}
        loading={deleting}
      />
    </div>
  );
}

