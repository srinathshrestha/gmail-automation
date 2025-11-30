// Dashboard stats API route
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, messages, senderStats } from "@/lib/db";
import { getActiveGoogleAccount } from "@/lib/auth-helpers";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;

    // Get active GoogleAccount
    const account = await getActiveGoogleAccount(userId);
    if (!account) {
      return NextResponse.json({ error: "No active Google account found. Please connect a Gmail account in settings." }, { status: 404 });
    }

    // Get total email count
    const totalEmailsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id)
        )
      );
    const totalEmails = Number(totalEmailsResult[0]?.count || 0);

    // Get total senders count
    const totalSendersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(senderStats)
      .where(
        and(
          eq(senderStats.userId, userId),
          eq(senderStats.googleAccountId, account.id)
        )
      );
    const totalSenders = Number(totalSendersResult[0]?.count || 0);

    // Get replied vs not replied counts
    const repliedCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id),
          eq(messages.hasUserReplied, true)
        )
      );
    const repliedCount = Number(repliedCountResult[0]?.count || 0);
    const notRepliedCount = totalEmails - repliedCount;

    // Get deleted count
    const deletedCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id),
          eq(messages.isDeletedByApp, true)
        )
      );
    const deletedCount = Number(deletedCountResult[0]?.count || 0);

    // Get top senders
    const topSenders = await db
      .select()
      .from(senderStats)
      .where(
        and(
          eq(senderStats.userId, userId),
          eq(senderStats.googleAccountId, account.id)
        )
      )
      .orderBy(desc(senderStats.totalCount))
      .limit(20);

    // Get category distribution
    const categoryCounts = await db
      .select({
        aiCategory: messages.aiCategory,
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id)
        )
      )
      .groupBy(messages.aiCategory);

    const categories: Record<string, number> = {};
    categoryCounts.forEach((item) => {
      categories[item.aiCategory] = Number(item.count);
    });

    // Get last synced message
    const lastSyncedMessages = await db
      .select({ lastSyncedAt: messages.lastSyncedAt })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id)
        )
      )
      .orderBy(desc(messages.lastSyncedAt))
      .limit(1);

    return NextResponse.json({
      totalEmails,
      totalSenders,
      repliedCount,
      notRepliedCount,
      deletedCount,
      topSenders: topSenders.map((s) => ({
        sender: s.sender,
        totalCount: s.totalCount,
        deletedByAppCount: s.deletedByAppCount,
        manuallyKeptCount: s.manuallyKeptCount,
        lastEmailAt: s.lastEmailAt?.toISOString() || null,
      })),
      categories,
      lastSyncedAt: lastSyncedMessages[0]?.lastSyncedAt.toISOString() || null,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
