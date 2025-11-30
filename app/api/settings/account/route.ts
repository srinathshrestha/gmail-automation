// Settings account API route
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db, messages } from "@/lib/db";
import { getUserGoogleAccount } from "@/lib/auth-helpers";
import { eq, and, desc, isNotNull } from "drizzle-orm";

export async function GET() {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get GoogleAccount
    const account = await getUserGoogleAccount(userId);
    if (!account) {
      return NextResponse.json({ error: "No Google account found" }, { status: 404 });
    }

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

    // Get last classified message (where aiDeleteScore is not null)
    const lastClassifiedMessages = await db
      .select({ updatedAt: messages.updatedAt })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id),
          isNotNull(messages.aiDeleteScore)
        )
      )
      .orderBy(desc(messages.updatedAt))
      .limit(1);

    return NextResponse.json({
      email: account.emailAddress,
      lastSyncedAt: lastSyncedMessages[0]?.lastSyncedAt.toISOString() || null,
      lastClassificationAt: lastClassifiedMessages[0]?.updatedAt.toISOString() || null,
    });
  } catch (error) {
    console.error("Error fetching account info:", error);
    return NextResponse.json(
      { error: "Failed to fetch account info", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
