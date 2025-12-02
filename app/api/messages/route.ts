// Messages API route - returns filtered list of messages
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, messages } from "@/lib/db";
import { getActiveGoogleAccount } from "@/lib/auth-helpers";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const sender = searchParams.get("sender");
    const category = searchParams.get("category");
    const readStatus = searchParams.get("readStatus"); // "all", "read", or "unread"
    const candidatesOnly = searchParams.get("candidatesOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build where conditions
    const conditions = [
      eq(messages.userId, userId),
      eq(messages.googleAccountId, account.id),
      eq(messages.isDeletedByApp, false), // Only show non-deleted messages
    ];

    if (sender && sender !== "all") {
      conditions.push(eq(messages.sender, sender));
    }

    if (category && category !== "all") {
      conditions.push(eq(messages.aiCategory, category as any));
    }

    if (candidatesOnly) {
      conditions.push(eq(messages.isDeleteCandidate, true));
    }

    // Query messages
    let messageList = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.internalDate))
      .limit(limit * 2) // Fetch more to account for client-side filtering
      .offset(offset);

    // Filter by read status (labels array contains "UNREAD" for unread messages)
    if (readStatus === "unread") {
      messageList = messageList.filter((msg) => msg.labels.includes("UNREAD"));
    } else if (readStatus === "read") {
      messageList = messageList.filter((msg) => !msg.labels.includes("UNREAD"));
    }

    // Apply limit after filtering
    messageList = messageList.slice(0, limit);

    return NextResponse.json({
      success: true,
      messages: messageList.map((msg) => ({
        id: msg.id,
        sender: msg.sender,
        senderName: msg.senderName,
        subject: msg.subject,
        snippet: msg.snippet,
        internalDate: msg.internalDate.toISOString(),
        labels: msg.labels,
        aiCategory: msg.aiCategory,
        aiDeleteScore: msg.aiDeleteScore,
        hasUserReplied: msg.hasUserReplied,
        isDeleteCandidate: msg.isDeleteCandidate,
        isDeletedByApp: msg.isDeletedByApp,
        isManuallyKept: msg.isManuallyKept,
      })),
      total: messageList.length,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
