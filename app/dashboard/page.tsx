// Dashboard page - shows email statistics and analytics
// Optimized with caching to prevent unnecessary reloads on tab switching
"use client";

import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { SenderList } from "@/components/dashboard/sender-list";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardStats {
  totalEmails: number;
  totalSenders: number;
  repliedCount: number;
  notRepliedCount: number;
  deletedCount: number;
  topSenders: Array<{
    sender: string;
    totalCount: number;
    deletedByAppCount: number;
    manuallyKeptCount: number;
    lastEmailAt: string | null;
  }>;
  categories: Record<string, number>;
  lastSyncedAt: string | null;
}

// Cache duration: 30 seconds (data is fresh enough, prevents excessive reloads)
const CACHE_DURATION = 30 * 1000;

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cache management
  const cacheRef = useRef<{ data: DashboardStats | null; timestamp: number } | null>(null);
  const fetchInProgressRef = useRef(false);

  // Load cached data from localStorage on mount for instant display
  useEffect(() => {
    const cachedStats = localStorage.getItem("dashboardStats");
    if (cachedStats) {
      try {
        const { data, timestamp } = JSON.parse(cachedStats);
        setStats(data);
        cacheRef.current = { data, timestamp };
        setLoading(false);
      } catch (e) {
        console.error("Failed to parse cached stats:", e);
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
      fetchStats(stats !== null); // Silent if we have data
    }
  }, [status, session, router]);

  // Handle visibility change (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only refetch if tab becomes visible AND cache is stale
      if (document.visibilityState === "visible" && status === "authenticated") {
        const now = Date.now();
        if (
          !cacheRef.current ||
          now - cacheRef.current.timestamp > CACHE_DURATION
        ) {
          fetchStats(true); // Silent refresh
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [status]);

  async function fetchStats(silent = false) {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) return;
    
    try {
      // Only show loading if we don't have stats yet
      if (!silent && stats === null) {
        setLoading(true);
      }
      fetchInProgressRef.current = true;
      
      const response = await fetch("/api/dashboard/stats", {
        // Add cache control headers
        next: { revalidate: 30 },
      });
      
      // Handle 404 - no Gmail account connected
      if (response.status === 404) {
        setError("NO_ACCOUNT");
        setStats(null);
        cacheRef.current = null;
        return;
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      
      const data = await response.json();
      const now = Date.now();
      
      // Update cache
      cacheRef.current = {
        data,
        timestamp: now,
      };

      // Save to localStorage for instant load next time
      localStorage.setItem("dashboardStats", JSON.stringify({
        data,
        timestamp: now,
      }));
      
      setStats(data);
      setError(null);
    } catch (err) {
      // Only show error if not silent refresh
      if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      fetchInProgressRef.current = false;
    }
  }

  // Show welcome message if no Gmail account connected
  if (error === "NO_ACCOUNT") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-2xl mb-2">Welcome to InboxJanitor!</CardTitle>
              <CardDescription className="text-base">
                Connect your Gmail account to start managing your inbox with AI-powered automation
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Get Started:</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <span>Connect your Gmail account to sync your emails</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <span>AI will analyze your inbox and suggest emails to delete</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <span>Review suggestions and clean up your inbox in minutes</span>
                </li>
              </ol>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={() => router.push("/settings")}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-md font-medium transition-colors"
              >
                Connect Gmail Account
              </button>
              <button
                onClick={() => router.push("/privacy")}
                className="flex-1 border border-border hover:bg-muted px-6 py-3 rounded-md font-medium transition-colors"
              >
                Learn About Privacy
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error only if we have no cached data
  if (error && !stats) {
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
    <div className="space-y-4 sm:space-y-6">
      {/* Always show static header */}
      <div className="px-1 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Overview of your email inbox
        </p>
      </div>

      {/* Stats Cards - static labels always visible */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Emails"
          value={stats?.totalEmails ? stats.totalEmails.toLocaleString() : null}
          icon="Mail"
          description="Synced messages"
          loading={loading}
        />
        <StatsCard
          title="Total Senders"
          value={stats?.totalSenders ? stats.totalSenders.toLocaleString() : null}
          icon="Users"
          description="Unique senders"
          loading={loading}
        />
        <StatsCard
          title="Replied"
          value={stats?.repliedCount ? stats.repliedCount.toLocaleString() : null}
          icon="Reply"
          description={
            stats?.notRepliedCount !== undefined
              ? `${stats.notRepliedCount.toLocaleString()} not replied`
              : undefined
          }
          loading={loading}
        />
        <StatsCard
          title="Deleted"
          value={stats?.deletedCount ? stats.deletedCount.toLocaleString() : null}
          icon="Trash"
          description="By app"
          loading={loading}
        />
      </div>

      {/* Top Senders and Categories - static headers always visible */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <SenderList
          senders={stats?.topSenders ? stats.topSenders.slice(0, 10) : null}
          loading={loading}
        />
        <CategoryBreakdown categories={stats?.categories || null} loading={loading} />
      </div>

      {/* Last Sync Info - only show if we have data */}
      {stats?.lastSyncedAt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Last Sync</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {new Date(stats.lastSyncedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
