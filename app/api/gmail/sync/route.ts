// Gmail sync route
// Fetches messages from Gmail and upserts to database

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getGmailClient,
  listMessages,
  getMessageMetadata,
  getThreadDetails,
  parseSender,
} from "@/lib/gmail-client";
import { db, messages, senderStats } from "@/lib/db";
import { getUserGoogleAccount } from "@/lib/auth-helpers";
import { eq, and } from "drizzle-orm";

// Maximum messages to sync per request (to avoid quota limits)
const MAX_MESSAGES_PER_SYNC = 500;

// Days to look back for messages (90 days)
const DAYS_TO_SYNC = 90;

export async function POST(_request: NextRequest) {
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

    // Get Gmail client
    let gmail;
    try {
      const client = await getGmailClient(userId);
      gmail = client.gmail;
    } catch (error) {
      console.error("Error getting Gmail client:", error);
      return NextResponse.json(
        {
          error: "Failed to connect to Gmail",
          details: error instanceof Error ? error.message : "Unknown error",
          hint: "Try signing out and signing in again to refresh your Gmail permissions",
        },
        { status: 500 }
      );
    }

    // Calculate date range (last 90 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_SYNC);
    const cutoffDateSeconds = Math.floor(cutoffDate.getTime() / 1000);

    // Build query for messages in date range
    const query = `after:${cutoffDateSeconds}`;

    // List messages
    let gmailMessages;
    try {
      const result = await listMessages(gmail, query, MAX_MESSAGES_PER_SYNC);
      gmailMessages = result.messages;
    } catch (error: unknown) {
      console.error("Error listing Gmail messages:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Type guard for error with apiNotEnabled property
      const hasApiNotEnabled = (
        err: unknown
      ): err is { apiNotEnabled: boolean; enableUrl?: string } => {
        return (
          typeof err === "object" && err !== null && "apiNotEnabled" in err
        );
      };

      // Check for Gmail API not enabled error (specific case)
      if (
        (hasApiNotEnabled(error) && error.apiNotEnabled) ||
        errorMessage.includes("Gmail API is not enabled")
      ) {
        const enableUrl =
          (hasApiNotEnabled(error) && error.enableUrl) ||
          "https://console.developers.google.com/apis/library/gmail.googleapis.com";
        return NextResponse.json(
          {
            error: "Gmail API Not Enabled",
            details:
              "The Gmail API must be enabled in your Google Cloud project before you can sync emails.",
            solution: "Enable Gmail API",
            enableUrl: enableUrl,
            instructions: [
              "1. Go to Google Cloud Console",
              "2. Select your project",
              "3. Navigate to APIs & Services > Library",
              "4. Search for 'Gmail API'",
              "5. Click 'Enable'",
              "6. Wait a few minutes for changes to propagate",
              "7. Try syncing again",
            ],
            hint: `Click here to enable: ${enableUrl}`,
          },
          { status: 403 }
        );
      }

      // Check for common Gmail API errors
      if (
        errorMessage.includes("insufficient authentication") ||
        errorMessage.includes("Invalid Credentials")
      ) {
        return NextResponse.json(
          {
            error: "Gmail authentication failed",
            details:
              "Your Gmail access token may have expired. Please sign out and sign in again.",
            hint: "Try signing out and signing in again",
          },
          { status: 401 }
        );
      }
      if (
        errorMessage.includes("quota") ||
        errorMessage.includes("rate limit")
      ) {
        return NextResponse.json(
          {
            error: "Gmail API quota exceeded",
            details: "Too many requests. Please try again in a few minutes.",
            hint: "Wait a few minutes and try again",
          },
          { status: 429 }
        );
      }

      // Generic 403 error - likely API not enabled
      const hasErrorCode = (
        err: unknown
      ): err is { code?: number; response?: { status?: number } } => {
        return typeof err === "object" && err !== null;
      };
      if (
        hasErrorCode(error) &&
        (error.code === 403 || error.response?.status === 403)
      ) {
        return NextResponse.json(
          {
            error: "Gmail API Access Denied",
            details: errorMessage,
            hint: "The Gmail API may not be enabled in your Google Cloud project. Please enable it in Google Cloud Console.",
            enableUrl:
              "https://console.developers.google.com/apis/library/gmail.googleapis.com",
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to fetch Gmail messages",
          details: errorMessage,
          hint: "Check your Gmail API permissions and ensure the API is enabled",
        },
        { status: 500 }
      );
    }

    if (!gmailMessages || gmailMessages.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        updated: 0,
        created: 0,
        lastSyncedAt: new Date().toISOString(),
        message: "No messages found in the last 90 days",
      });
    }

    let created = 0;
    let updated = 0;
    let errors = 0;

    // Process each message
    for (const msg of gmailMessages) {
      try {
        // Get message metadata
        const metadata = await getMessageMetadata(gmail, msg.id);

        // Parse sender
        const fromHeader = metadata.headers.from || "";
        const { email: senderEmail, name: senderName } =
          parseSender(fromHeader);

        // Check if user replied (check thread)
        const { hasUserReplied } = await getThreadDetails(
          gmail,
          metadata.threadId,
          account.emailAddress
        );

        // Convert internalDate (milliseconds) to Date
        const internalDate = new Date(metadata.internalDate);

        // Check if message exists
        const existingMessages = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.googleAccountId, account.id),
              eq(messages.gmailMessageId, metadata.id)
            )
          )
          .limit(1);

        if (existingMessages.length > 0) {
          // Update existing message
          await db
            .update(messages)
            .set({
              gmailThreadId: metadata.threadId,
              sender: senderEmail,
              senderName,
              subject: metadata.headers.subject || "",
              snippet: metadata.snippet,
              internalDate,
              labels: metadata.labels,
              hasUserReplied,
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(messages.id, existingMessages[0].id));
          updated++;
        } else {
          // Create new message
          const now = new Date();
          await db.insert(messages).values({
            userId,
            googleAccountId: account.id,
            gmailMessageId: metadata.id,
            gmailThreadId: metadata.threadId,
            sender: senderEmail,
            senderName,
            subject: metadata.headers.subject || "",
            snippet: metadata.snippet,
            internalDate,
            labels: metadata.labels,
            hasUserReplied,
            lastSyncedAt: now,
            createdAt: now,
            updatedAt: now,
          });
          created++;

          // Update sender stats incrementally
          await updateSenderStats(
            userId,
            account.id,
            senderEmail,
            internalDate
          );
        }
      } catch (error) {
        console.error(`Error processing message ${msg.id}:`, error);
        errors++;
        // Continue with next message
      }
    }

    return NextResponse.json({
      success: true,
      synced: gmailMessages.length,
      created,
      updated,
      errors,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in Gmail sync:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log full error for debugging
    console.error("Full error details:", {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to sync Gmail messages",
        details: errorMessage,
        hint: "Check the server logs for more details. Common issues: expired tokens, API quota limits, or network errors.",
      },
      { status: 500 }
    );
  }
}

/**
 * Update sender stats incrementally
 */
async function updateSenderStats(
  userId: string,
  googleAccountId: string,
  sender: string,
  lastEmailAt: Date
) {
  // Check if stats exist
  const existingStats = await db
    .select()
    .from(senderStats)
    .where(
      and(
        eq(senderStats.googleAccountId, googleAccountId),
        eq(senderStats.sender, sender)
      )
    )
    .limit(1);

  if (existingStats.length > 0) {
    // Update existing stats
    await db
      .update(senderStats)
      .set({
        totalCount: existingStats[0].totalCount + 1,
        lastEmailAt,
        updatedAt: new Date(),
      })
      .where(eq(senderStats.id, existingStats[0].id));
  } else {
    // Create new stats
    const now = new Date();
    await db.insert(senderStats).values({
      userId,
      googleAccountId,
      sender,
      totalCount: 1,
      lastEmailAt,
      createdAt: now,
      updatedAt: now,
    });
  }
}
