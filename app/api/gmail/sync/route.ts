// Gmail sync route
// Fetches messages from Gmail and upserts to database
// Uses chunked processing to avoid Vercel timeout (300s limit)
// Tracks progress in database for resumable syncs

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getGmailClient,
  listMessages,
  getMessageMetadata,
  getThreadDetails,
  parseSender,
} from "@/lib/gmail-client";
import {
  db,
  messages,
  senderStats,
  syncProgress,
  type SyncProgress,
} from "@/lib/db";
import { getActiveGoogleAccount } from "@/lib/auth-helpers";
import { eq, and, desc } from "drizzle-orm";

// Messages to process per chunk (smaller batches to avoid timeout)
const MESSAGES_PER_CHUNK = 50;

// Maximum messages to fetch per Gmail API call
const MAX_MESSAGES_PER_API_CALL = 500;

// Days to look back for messages (90 days)
const DAYS_TO_SYNC = 90;

// Timeout safety margin (seconds) - return early before Vercel timeout
const TIMEOUT_SAFETY_MARGIN = 50; // Leave 50 seconds buffer before 300s timeout

/**
 * GET endpoint - Fetch sync progress for the current user
 */
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

    // Get latest sync progress
    const progress = await db
      .select()
      .from(syncProgress)
      .where(
        and(
          eq(syncProgress.userId, userId),
          eq(syncProgress.googleAccountId, account.id)
        )
      )
      .orderBy(desc(syncProgress.startedAt))
      .limit(1);

    if (progress.length === 0) {
      return NextResponse.json({
        status: "idle",
        message: "No sync in progress",
      });
    }

    const currentProgress = progress[0];

    // Calculate progress percentage
    const progressPercent =
      currentProgress.totalMessages > 0
        ? Math.round(
            (currentProgress.processedMessages /
              currentProgress.totalMessages) *
              100
          )
        : 0;

    return NextResponse.json({
      id: currentProgress.id,
      status: currentProgress.status,
      totalMessages: currentProgress.totalMessages,
      processedMessages: currentProgress.processedMessages,
      created: currentProgress.created,
      updated: currentProgress.updated,
      errors: currentProgress.errors,
      progress: progressPercent,
      hasMore: !!currentProgress.nextPageToken,
      startedAt: currentProgress.startedAt.toISOString(),
      updatedAt: currentProgress.updatedAt.toISOString(),
      completedAt: currentProgress.completedAt?.toISOString() || null,
      errorMessage: currentProgress.errorMessage || null,
    });
  } catch (error) {
    console.error("Error fetching sync progress:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch sync progress",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  // Track start time to avoid timeout
  const startTime = Date.now();
  const maxExecutionTime = (300 - TIMEOUT_SAFETY_MARGIN) * 1000; // Convert to milliseconds

  // Declare progressRecord outside try block so it's accessible in catch
  let progressRecord: SyncProgress | null = null;

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

    // Check for existing in-progress sync
    const existingSync = await db
      .select()
      .from(syncProgress)
      .where(
        and(
          eq(syncProgress.userId, userId),
          eq(syncProgress.googleAccountId, account.id),
          eq(syncProgress.status, "in_progress")
        )
      )
      .orderBy(desc(syncProgress.startedAt))
      .limit(1);

    let isResuming = false;

    if (existingSync.length > 0) {
      // Resume existing sync
      progressRecord = existingSync[0];
      isResuming = true;
    } else {
      // Create new sync progress record
      const now = new Date();
      const [newProgress] = await db
        .insert(syncProgress)
        .values({
          userId,
          googleAccountId: account.id,
          status: "in_progress",
          totalMessages: 0,
          processedMessages: 0,
          created: 0,
          updated: 0,
          errors: 0,
          startedAt: now,
          updatedAt: now,
        })
        .returning();
      progressRecord = newProgress;
    }

    // Get Gmail client
    let gmail;
    try {
      const client = await getGmailClient(userId);
      gmail = client.gmail;
    } catch (error) {
      console.error("Error getting Gmail client:", error);
      // Mark sync as failed
      await db
        .update(syncProgress)
        .set({
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncProgress.id, progressRecord.id));
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

    // List messages (with pagination support for resuming)
    let gmailMessages;
    let nextPageToken: string | undefined =
      progressRecord.nextPageToken || undefined;
    let totalMessages = progressRecord.totalMessages || 0;

    try {
      const result = await listMessages(
        gmail,
        query,
        MAX_MESSAGES_PER_API_CALL,
        nextPageToken
      );
      gmailMessages = result.messages;
      nextPageToken = result.nextPageToken;

      // Update total messages if this is the first batch
      if (!isResuming && totalMessages === 0) {
        totalMessages = gmailMessages.length;
        // If there's a nextPageToken, we know there are more messages
        // We'll update totalMessages as we discover more
      }
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

      // Mark sync as failed
      await db
        .update(syncProgress)
        .set({
          status: "failed",
          errorMessage: errorMessage,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncProgress.id, progressRecord.id));

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
      // No more messages to process
      await db
        .update(syncProgress)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncProgress.id, progressRecord.id));

      return NextResponse.json({
        success: true,
        synced: progressRecord.processedMessages,
        created: progressRecord.created,
        updated: progressRecord.updated,
        errors: progressRecord.errors,
        lastSyncedAt: new Date().toISOString(),
        message: "Sync completed",
        progressId: progressRecord.id,
      });
    }

    // Initialize counters from existing progress or start fresh
    let created = progressRecord.created;
    let updated = progressRecord.updated;
    let errors = progressRecord.errors;
    let processed = progressRecord.processedMessages;

    // Process messages in chunks, checking timeout periodically
    const messagesToProcess = gmailMessages.slice(0, MESSAGES_PER_CHUNK);
    let processedInThisBatch = 0;

    for (const msg of messagesToProcess) {
      // Check if we're approaching timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > maxExecutionTime) {
        // Update progress and return early
        await db
          .update(syncProgress)
          .set({
            processedMessages: processed,
            created,
            updated,
            errors,
            nextPageToken: nextPageToken || null,
            updatedAt: new Date(),
          })
          .where(eq(syncProgress.id, progressRecord.id));

        return NextResponse.json({
          success: true,
          synced: processed,
          created,
          updated,
          errors,
          message: "Sync in progress - processing in chunks to avoid timeout",
          progressId: progressRecord.id,
          hasMore: !!nextPageToken,
          progress:
            totalMessages > 0
              ? Math.round((processed / totalMessages) * 100)
              : 0,
        });
      }

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

        processed++;
        processedInThisBatch++;

        // Update progress every 10 messages to keep it current
        if (processedInThisBatch % 10 === 0) {
          await db
            .update(syncProgress)
            .set({
              processedMessages: processed,
              created,
              updated,
              errors,
              updatedAt: new Date(),
            })
            .where(eq(syncProgress.id, progressRecord.id));
        }
      } catch (error) {
        console.error(`Error processing message ${msg.id}:`, error);
        errors++;
        processed++;
        // Continue with next message
      }
    }

    // Update progress after batch
    await db
      .update(syncProgress)
      .set({
        processedMessages: processed,
        created,
        updated,
        errors,
        nextPageToken: nextPageToken || null,
        updatedAt: new Date(),
      })
      .where(eq(syncProgress.id, progressRecord.id));

    // If there are more messages (nextPageToken exists), return partial success
    // Frontend will need to call sync again to continue
    if (nextPageToken) {
      return NextResponse.json({
        success: true,
        synced: processed,
        created,
        updated,
        errors,
        message: "Sync in progress - more messages to process",
        progressId: progressRecord.id,
        hasMore: true,
        progress:
          totalMessages > 0 ? Math.round((processed / totalMessages) * 100) : 0,
      });
    }

    // Sync completed
    await db
      .update(syncProgress)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(syncProgress.id, progressRecord.id));

    return NextResponse.json({
      success: true,
      synced: processed,
      created,
      updated,
      errors,
      lastSyncedAt: new Date().toISOString(),
      message: "Sync completed",
      progressId: progressRecord.id,
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

    // Check if this is a timeout error
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("Task timed out") ||
      errorMessage.includes("504") ||
      errorMessage.includes("ETIMEDOUT")
    ) {
      // Update progress to indicate timeout (but keep it in_progress so it can be resumed)
      if (progressRecord) {
        await db
          .update(syncProgress)
          .set({
            status: "timeout",
            errorMessage: "Sync timed out - will resume on next sync",
            updatedAt: new Date(),
          })
          .where(eq(syncProgress.id, progressRecord.id));
      }

      return NextResponse.json(
        {
          error: "Sync timed out",
          details:
            "The sync operation took too long and was interrupted. Progress has been saved.",
          hint: "The sync will automatically resume when you try again. Progress is tracked in the database.",
          progressId: progressRecord?.id,
          canResume: true,
        },
        { status: 504 }
      );
    }

    // Mark sync as failed for other errors
    if (progressRecord) {
      await db
        .update(syncProgress)
        .set({
          status: "failed",
          errorMessage: errorMessage,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncProgress.id, progressRecord.id));
    }

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
