// Dashboard page - shows email statistics and analytics
// Optimized with caching to prevent unnecessary reloads on tab switching
"use client";

import { useSession } from "next-auth/react";
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session) {
      fetchStats();
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
    
    // Check cache first
    const now = Date.now();
    if (
      !silent &&
      cacheRef.current &&
      now - cacheRef.current.timestamp < CACHE_DURATION
    ) {
      setStats(cacheRef.current.data);
      setLoading(false);
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      fetchInProgressRef.current = true;
      
      const response = await fetch("/api/dashboard/stats", {
        // Add cache control headers
        next: { revalidate: 30 },
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      
      const data = await response.json();
      
      // Update cache
      cacheRef.current = {
        data,
        timestamp: now,
      };
      
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
    <div className="space-y-6">
      {/* Always show static header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Overview of your email inbox
        </p>
      </div>

      {/* Stats Cards - static labels always visible */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="grid gap-4 md:grid-cols-2">
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
            <CardTitle>Last Sync</CardTitle>
            <CardDescription>
              {new Date(stats.lastSyncedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
