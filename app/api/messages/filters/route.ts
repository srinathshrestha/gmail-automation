// Messages filters API route - returns available filter options
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, messages } from "@/lib/db";
import { getActiveGoogleAccount } from "@/lib/auth-helpers";
import { eq, and } from "drizzle-orm";

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
      return NextResponse.json(
        {
          error:
            "No active Google account found. Please connect a Gmail account in settings.",
        },
        { status: 404 }
      );
    }

    // Get unique senders
    const sendersResult = await db
      .select({ sender: messages.sender })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id)
        )
      )
      .groupBy(messages.sender)
      .orderBy(messages.sender)
      .limit(100);

    // Get unique categories
    const categoriesResult = await db
      .select({ aiCategory: messages.aiCategory })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id)
        )
      )
      .groupBy(messages.aiCategory);

    return NextResponse.json({
      success: true,
      senders: sendersResult.map((s) => s.sender),
      categories: categoriesResult.map((c) => c.aiCategory),
    });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch filter options",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
