// Agent confirm-delete route
// Deletes selected messages and records batch operation

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, messages, deleteBatches, deleteBatchItems } from "@/lib/db";
import { getGmailClient, trashMessage } from "@/lib/gmail-client";
import { getActiveGoogleAccount } from "@/lib/auth-helpers";
import { z } from "zod";
import { recordDeletion, recordKeep } from "@/lib/learning";
import { eq, and } from "drizzle-orm";

// Helper function to send progress update
function sendProgress(
  controller: ReadableStreamDefaultController,
  data: { deleted: number; total: number; remaining: number; errors: number }
) {
  const chunk = JSON.stringify({ type: "progress", ...data }) + "\n";
  controller.enqueue(new TextEncoder().encode(chunk));
}

// Request body schema
const confirmDeleteSchema = z.object({
  messageIds: z.array(z.string().uuid()),
});

export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    const { messageIds } = confirmDeleteSchema.parse(body);

    if (messageIds.length === 0) {
      return NextResponse.json(
        { error: "No message IDs provided" },
        { status: 400 }
      );
    }

    // Check if streaming is requested (for progress updates)
    const streamProgress = body.stream === true;

    // Get Gmail client
    const { gmail } = await getGmailClient(userId);

    // Get all candidate messages for this user
    const allCandidates = await db
      .select({
        id: messages.id,
        gmailMessageId: messages.gmailMessageId,
        sender: messages.sender,
      })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id),
          eq(messages.isDeleteCandidate, true),
          eq(messages.isDeletedByApp, false)
        )
      );

    // Create delete batch record
    const [deleteBatch] = await db
      .insert(deleteBatches)
      .values({
        userId,
        googleAccountId: account.id,
        totalCandidates: allCandidates.length,
        totalDeleted: 0,
        status: "pending",
      })
      .returning();

    let deletedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const totalToDelete = messageIds.length;

    // If streaming, create a streaming response
    if (streamProgress) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Process each message ID
            for (const messageId of messageIds) {
              try {
                // Find message
                const messageResult = await db
                  .select()
                  .from(messages)
                  .where(eq(messages.id, messageId))
                  .limit(1);

                if (messageResult.length === 0) {
                  errors.push(`Message ${messageId} not found`);
                  errorCount++;
                  sendProgress(controller, {
                    deleted: deletedCount,
                    total: totalToDelete,
                    remaining: totalToDelete - deletedCount - errorCount,
                    errors: errorCount,
                  });
                  continue;
                }

                const message = messageResult[0];

                if (message.isDeletedByApp) {
                  skippedCount++;
                  sendProgress(controller, {
                    deleted: deletedCount,
                    total: totalToDelete,
                    remaining: totalToDelete - deletedCount - errorCount,
                    errors: errorCount,
                  });
                  continue;
                }

                // Delete message in Gmail (move to trash)
                await trashMessage(gmail, message.gmailMessageId);

                // Update message record
                await db
                  .update(messages)
                  .set({
                    isDeletedByApp: true,
                    isManuallyDeleted: true,
                    updatedAt: new Date(),
                  })
                  .where(eq(messages.id, messageId));

                // Record deletion for learning
                await recordDeletion(userId, messageId, message.sender);

                // Create batch item
                await db.insert(deleteBatchItems).values({
                  deleteBatchId: deleteBatch.id,
                  messageId: message.id,
                  gmailMessageId: message.gmailMessageId,
                  decision: "deleted",
                  createdAt: new Date(),
                });

                deletedCount++;

                // Send progress update
                sendProgress(controller, {
                  deleted: deletedCount,
                  total: totalToDelete,
                  remaining: totalToDelete - deletedCount - errorCount,
                  errors: errorCount,
                });
              } catch (error) {
                console.error(`Error deleting message ${messageId}:`, error);
                errors.push(
                  `Failed to delete ${messageId}: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`
                );
                errorCount++;

                sendProgress(controller, {
                  deleted: deletedCount,
                  total: totalToDelete,
                  remaining: totalToDelete - deletedCount - errorCount,
                  errors: errorCount,
                });

                // Create batch item with error
                try {
                  const messageResult = await db
                    .select()
                    .from(messages)
                    .where(eq(messages.id, messageId))
                    .limit(1);
                  if (messageResult.length > 0) {
                    await db.insert(deleteBatchItems).values({
                      deleteBatchId: deleteBatch.id,
                      messageId: messageResult[0].id,
                      gmailMessageId: messageResult[0].gmailMessageId,
                      decision: "error",
                      reason:
                        error instanceof Error
                          ? error.message
                          : "Unknown error",
                      createdAt: new Date(),
                    });
                  }
                } catch (itemError) {
                  console.error("Error creating batch item:", itemError);
                }
              }
            }

            // Handle deselected candidates (user kept them)
            const selectedIds = new Set(messageIds);
            const deselectedCandidates = allCandidates.filter(
              (c) => !selectedIds.has(c.id)
            );

            for (const candidate of deselectedCandidates) {
              try {
                // Mark as manually kept
                await db
                  .update(messages)
                  .set({
                    isManuallyKept: true,
                    isDeleteCandidate: false,
                    updatedAt: new Date(),
                  })
                  .where(eq(messages.id, candidate.id));

                // Record keep for learning
                const messageResult = await db
                  .select()
                  .from(messages)
                  .where(eq(messages.id, candidate.id))
                  .limit(1);
                if (messageResult.length > 0) {
                  await recordKeep(
                    userId,
                    candidate.id,
                    messageResult[0].sender
                  );
                }

                // Create batch item
                await db.insert(deleteBatchItems).values({
                  deleteBatchId: deleteBatch.id,
                  messageId: candidate.id,
                  gmailMessageId: candidate.gmailMessageId,
                  decision: "skipped",
                  reason: "User deselected",
                  createdAt: new Date(),
                });
              } catch (error) {
                console.error(
                  `Error processing deselected candidate ${candidate.id}:`,
                  error
                );
              }
            }

            // Update delete batch status
            const status: "pending" | "completed" | "failed" =
              errorCount > 0 && deletedCount === 0 ? "failed" : "completed";
            await db
              .update(deleteBatches)
              .set({
                totalDeleted: deletedCount,
                status,
                finishedAt: new Date(),
                errorMessage: errors.length > 0 ? errors.join("; ") : null,
              })
              .where(eq(deleteBatches.id, deleteBatch.id));

            // Send final result
            const finalResult =
              JSON.stringify({
                type: "complete",
                success: true,
                deleted: deletedCount,
                skipped: skippedCount,
                errors: errorCount,
                errorMessages: errors,
                batchId: deleteBatch.id,
              }) + "\n";
            controller.enqueue(new TextEncoder().encode(finalResult));
            controller.close();
          } catch (error) {
            const errorResult =
              JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "Unknown error",
              }) + "\n";
            controller.enqueue(new TextEncoder().encode(errorResult));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming path (original implementation)
    // Process each message ID
    for (const messageId of messageIds) {
      try {
        // Find message
        const messageResult = await db
          .select()
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1);

        if (messageResult.length === 0) {
          errors.push(`Message ${messageId} not found`);
          errorCount++;
          continue;
        }

        const message = messageResult[0];

        if (message.isDeletedByApp) {
          skippedCount++;
          continue;
        }

        // Delete message in Gmail (move to trash)
        await trashMessage(gmail, message.gmailMessageId);

        // Update message record
        await db
          .update(messages)
          .set({
            isDeletedByApp: true,
            isManuallyDeleted: true,
            updatedAt: new Date(),
          })
          .where(eq(messages.id, messageId));

        // Record deletion for learning
        await recordDeletion(userId, messageId, message.sender);

        // Create batch item
        await db.insert(deleteBatchItems).values({
          deleteBatchId: deleteBatch.id,
          messageId: message.id,
          gmailMessageId: message.gmailMessageId,
          decision: "deleted",
          createdAt: new Date(),
        });

        deletedCount++;
      } catch (error) {
        console.error(`Error deleting message ${messageId}:`, error);
        errors.push(
          `Failed to delete ${messageId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        errorCount++;

        // Create batch item with error
        try {
          const messageResult = await db
            .select()
            .from(messages)
            .where(eq(messages.id, messageId))
            .limit(1);
          if (messageResult.length > 0) {
            await db.insert(deleteBatchItems).values({
              deleteBatchId: deleteBatch.id,
              messageId: messageResult[0].id,
              gmailMessageId: messageResult[0].gmailMessageId,
              decision: "error",
              reason: error instanceof Error ? error.message : "Unknown error",
              createdAt: new Date(),
            });
          }
        } catch (itemError) {
          console.error("Error creating batch item:", itemError);
        }
      }
    }

    // Handle deselected candidates (user kept them)
    const selectedIds = new Set(messageIds);
    const deselectedCandidates = allCandidates.filter(
      (c) => !selectedIds.has(c.id)
    );

    for (const candidate of deselectedCandidates) {
      try {
        // Mark as manually kept
        await db
          .update(messages)
          .set({
            isManuallyKept: true,
            isDeleteCandidate: false, // Remove from candidates
            updatedAt: new Date(),
          })
          .where(eq(messages.id, candidate.id));

        // Record keep for learning
        const messageResult = await db
          .select()
          .from(messages)
          .where(eq(messages.id, candidate.id))
          .limit(1);
        if (messageResult.length > 0) {
          await recordKeep(userId, candidate.id, messageResult[0].sender);
        }

        // Create batch item
        await db.insert(deleteBatchItems).values({
          deleteBatchId: deleteBatch.id,
          messageId: candidate.id,
          gmailMessageId: candidate.gmailMessageId,
          decision: "skipped",
          reason: "User deselected",
          createdAt: new Date(),
        });
      } catch (error) {
        console.error(
          `Error processing deselected candidate ${candidate.id}:`,
          error
        );
      }
    }

    // Update delete batch status
    const status: "pending" | "completed" | "failed" =
      errorCount > 0 && deletedCount === 0 ? "failed" : "completed";
    await db
      .update(deleteBatches)
      .set({
        totalDeleted: deletedCount,
        status,
        finishedAt: new Date(),
        errorMessage: errors.length > 0 ? errors.join("; ") : null,
      })
      .where(eq(deleteBatches.id, deleteBatch.id));

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      skipped: skippedCount,
      errors: errorCount,
      errorMessages: errors,
      batchId: deleteBatch.id,
    });
  } catch (error) {
    console.error("Error in confirm-delete:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to confirm deletion",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
