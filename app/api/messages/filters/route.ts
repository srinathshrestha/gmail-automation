// Messages filters API route - returns available filter options
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db, messages } from "@/lib/db";
import { getUserGoogleAccount } from "@/lib/auth-helpers";
import { eq, and } from "drizzle-orm";

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
      return NextResponse.json(
        { error: "No Google account found" },
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
