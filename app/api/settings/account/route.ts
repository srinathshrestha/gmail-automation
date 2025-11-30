// Settings account API route
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, messages } from "@/lib/db";
import { getUserGoogleAccounts, getActiveGoogleAccount } from "@/lib/auth-helpers";
import { eq, and, desc, isNotNull } from "drizzle-orm";

export async function GET() {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;

    // Get all GoogleAccounts
    const allAccounts = await getUserGoogleAccounts(userId);
    const activeAccount = await getActiveGoogleAccount(userId);

    // Get last synced message for active account
    let lastSyncedAt: string | null = null;
    let lastClassificationAt: string | null = null;

    if (activeAccount) {
      const lastSyncedMessages = await db
        .select({ lastSyncedAt: messages.lastSyncedAt })
        .from(messages)
        .where(
          and(
            eq(messages.userId, userId),
            eq(messages.googleAccountId, activeAccount.id)
          )
        )
        .orderBy(desc(messages.lastSyncedAt))
        .limit(1);

      const lastClassifiedMessages = await db
        .select({ updatedAt: messages.updatedAt })
        .from(messages)
        .where(
          and(
            eq(messages.userId, userId),
            eq(messages.googleAccountId, activeAccount.id),
            isNotNull(messages.aiDeleteScore)
          )
        )
        .orderBy(desc(messages.updatedAt))
        .limit(1);

      lastSyncedAt = lastSyncedMessages[0]?.lastSyncedAt.toISOString() || null;
      lastClassificationAt = lastClassifiedMessages[0]?.updatedAt.toISOString() || null;
    }

    return NextResponse.json({
      accounts: allAccounts.map((acc) => ({
        id: acc.id,
        emailAddress: acc.emailAddress,
        isActive: acc.isActive,
        createdAt: acc.createdAt.toISOString(),
      })),
      activeAccount: activeAccount
        ? {
            id: activeAccount.id,
            emailAddress: activeAccount.emailAddress,
          }
        : null,
      lastSyncedAt,
      lastClassificationAt,
    });
  } catch (error) {
    console.error("Error fetching account info:", error);
    return NextResponse.json(
      { error: "Failed to fetch account info", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
