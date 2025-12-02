// Agent suggest-deletes route
// Classifies emails and marks deletion candidates

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, messages, senderStats } from "@/lib/db";
import {
  classifyEmailsForDeletion,
  EmailInput,
  ClassificationResult,
} from "@/lib/ai/classify-emails";
import { getActiveGoogleAccount } from "@/lib/auth-helpers";
import { eq, and, lt, inArray, asc } from "drizzle-orm";

// Minimum age for emails to be considered (7 days)
const MIN_AGE_DAYS = 7;

// Delete score threshold (0.7 = 70% confidence)
const DELETE_SCORE_THRESHOLD = 0.7;

// Batch size for processing (reduced for faster response)
// 150 emails = ~3 AI calls = ~9 seconds
const BATCH_SIZE = 150;

export async function POST() {
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

    // Calculate cutoff date (7 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MIN_AGE_DAYS);

    // Get auto-include senders
    const autoIncludeSenders = account.autoIncludeSenders || [];
    const hasAutoIncludeSenders = autoIncludeSenders.length > 0;

    // Query messages to evaluate
    // Include messages that:
    // 1. Are not already deleted by app
    // 2. Haven't been manually kept
    // 3. Either:
    //    - Are older than 7 days (normal evaluation)
    //    - OR are from auto-include senders (regardless of age)
    const { or } = await import("drizzle-orm");

    const baseConditions = [
      eq(messages.userId, userId),
      eq(messages.googleAccountId, account.id),
      eq(messages.isDeletedByApp, false),
      eq(messages.isManuallyKept, false),
    ];

    // Build age condition: either older than 7 days OR from auto-include senders
    if (hasAutoIncludeSenders) {
      baseConditions.push(
        or(
          lt(messages.internalDate, cutoffDate),
          inArray(messages.sender, autoIncludeSenders)
        )!
      );
    } else {
      baseConditions.push(lt(messages.internalDate, cutoffDate));
    }

    const messageList = await db
      .select()
      .from(messages)
      .where(and(...baseConditions))
      .orderBy(asc(messages.internalDate))
      .limit(BATCH_SIZE);

    if (messageList.length === 0) {
      return NextResponse.json({
        success: true,
        evaluated: 0,
        candidates: 0,
      });
    }

    // Get sender stats for context
    const senderStatsMap = new Map<string, number>();
    const uniqueSenders = [...new Set(messageList.map((m) => m.sender))];

    if (uniqueSenders.length > 0) {
      const statsList = await db
        .select()
        .from(senderStats)
        .where(
          and(
            eq(senderStats.userId, userId),
            eq(senderStats.googleAccountId, account.id),
            inArray(senderStats.sender, uniqueSenders)
          )
        );

      statsList.forEach((stat) => {
        senderStatsMap.set(stat.sender, stat.totalCount);
      });
    }

    // Prepare email inputs for classification (including googleAccountId for learning)
    const emailInputs: EmailInput[] = messageList.map((msg) => ({
      gmailMessageId: msg.gmailMessageId,
      sender: msg.sender,
      subject: msg.subject,
      snippet: msg.snippet,
      labels: msg.labels,
      hasUserReplied: msg.hasUserReplied,
      senderFrequency: senderStatsMap.get(msg.sender) || 1,
      googleAccountId: account.id, // For learning system integration
    }));

    // Classify emails
    let classifications: ClassificationResult[];
    try {
      classifications = await classifyEmailsForDeletion(emailInputs);
    } catch (error) {
      console.error("Error classifying emails:", error);
      // Return partial success if we can't classify
      return NextResponse.json(
        {
          success: false,
          evaluated: 0,
          candidates: 0,
          error:
            "Failed to classify emails. The AI service may be experiencing issues. Please try again.",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // Verify we have classifications
    if (!classifications || classifications.length === 0) {
      return NextResponse.json(
        {
          success: false,
          evaluated: 0,
          candidates: 0,
          error: "No classifications returned",
        },
        { status: 500 }
      );
    }

    // Update messages with classification results (batch updates for speed)
    let candidatesCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // Batch all updates into a single Promise.all
    const updatePromises = classifications.map(async (classification) => {
      try {
        const message = messageList.find(
          (m) => m.gmailMessageId === classification.gmailMessageId
        );
        if (!message) {
          errors.push(`Message ${classification.gmailMessageId} not found`);
          return false;
        }

        const isDeleteCandidate =
          classification.deleteScore >= DELETE_SCORE_THRESHOLD;
        if (isDeleteCandidate) {
          candidatesCount++;
        }

        await db
          .update(messages)
          .set({
            aiCategory: classification.category,
            aiDeleteScore: classification.deleteScore,
            aiDeleteReason: classification.reason,
            isDeleteCandidate,
            updatedAt: new Date(),
          })
          .where(eq(messages.id, message.id));

        return true;
      } catch (error) {
        console.error(
          `Error updating message ${classification.gmailMessageId}:`,
          error
        );
        errors.push(
          `Failed to update message ${classification.gmailMessageId}`
        );
        return false;
      }
    });

    // Wait for all updates to complete in parallel
    const results = await Promise.all(updatePromises);
    updatedCount = results.filter((r) => r === true).length;

    return NextResponse.json({
      success: true,
      evaluated: messageList.length,
      updated: updatedCount,
      candidates: candidatesCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in suggest-deletes:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check if it's an auth error
    if (
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("session")
    ) {
      return NextResponse.json(
        { error: "Session expired. Please sign in again." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to suggest deletions", details: errorMessage },
      { status: 500 }
    );
  }
}
