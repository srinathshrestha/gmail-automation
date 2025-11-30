// Dashboard page - shows email statistics and analytics
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
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

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session) {
      fetchStats();
    }
  }, [status, session, router]);

  async function fetchStats() {
    try {
      setLoading(true);
      const response = await fetch("/api/dashboard/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
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

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Overview of your email inbox
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Emails"
          value={stats.totalEmails.toLocaleString()}
          icon="Mail"
          description="Synced messages"
        />
        <StatsCard
          title="Total Senders"
          value={stats.totalSenders.toLocaleString()}
          icon="Users"
          description="Unique senders"
        />
        <StatsCard
          title="Replied"
          value={stats.repliedCount.toLocaleString()}
          icon="Reply"
          description={`${stats.notRepliedCount.toLocaleString()} not replied`}
        />
        <StatsCard
          title="Deleted"
          value={stats.deletedCount.toLocaleString()}
          icon="Trash"
          description="By app"
        />
      </div>

      {/* Top Senders and Categories */}
      <div className="grid gap-4 md:grid-cols-2">
        <SenderList senders={stats.topSenders.slice(0, 10)} />
        <CategoryBreakdown categories={stats.categories} />
      </div>

      {/* Last Sync Info */}
      {stats.lastSyncedAt && (
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
