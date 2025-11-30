// Agent delete-candidates route
// Returns list of deletion candidates for user review

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db, messages } from "@/lib/db";
import { getUserGoogleAccount } from "@/lib/auth-helpers";
import { formatDistanceToNow } from "date-fns";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Query delete candidates
    const messageList = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id),
          eq(messages.isDeleteCandidate, true),
          eq(messages.isDeletedByApp, false)
        )
      )
      .orderBy(desc(messages.aiDeleteScore))
      .limit(limit)
      .offset(offset);

    // Format response
    const candidates = messageList.map((msg) => ({
      id: msg.id,
      gmailMessageId: msg.gmailMessageId,
      sender: msg.sender,
      senderName: msg.senderName,
      subject: msg.subject,
      snippet: msg.snippet,
      age: formatDistanceToNow(msg.internalDate, { addSuffix: true }),
      deleteScore: msg.aiDeleteScore,
      reason: msg.aiDeleteReason,
      category: msg.aiCategory,
      hasUserReplied: msg.hasUserReplied,
      labels: msg.labels,
    }));

    return NextResponse.json({
      success: true,
      candidates,
      total: candidates.length,
    });
  } catch (error) {
    console.error("Error in delete-candidates:", error);
    return NextResponse.json(
      { error: "Failed to fetch delete candidates", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
