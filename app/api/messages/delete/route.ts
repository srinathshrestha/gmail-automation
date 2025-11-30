// Manual delete route for messages page
// Allows users to manually delete selected messages

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getGmailClient, trashMessage } from "@/lib/gmail-client";
import { db, messages } from "@/lib/db";
import { getUserGoogleAccount } from "@/lib/auth-helpers";
import { recordManualDeletion } from "@/lib/learning";
import { eq, and, inArray } from "drizzle-orm";

// Helper function to send progress update
function sendProgress(
  controller: ReadableStreamDefaultController,
  data: { deleted: number; total: number; remaining: number; errors: number }
) {
  const chunk = JSON.stringify({ type: "progress", ...data }) + "\n";
  controller.enqueue(new TextEncoder().encode(chunk));
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get request body
    const body = await request.json();
    const { messageIds } = body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: "messageIds array is required" }, { status: 400 });
    }

    // Check if streaming is requested (for progress updates)
    const streamProgress = body.stream === true;

    // Get GoogleAccount
    const account = await getUserGoogleAccount(userId);
    if (!account) {
      return NextResponse.json({ error: "No Google account found" }, { status: 404 });
    }

    // Get Gmail client
    const { gmail } = await getGmailClient(userId);

    // Get messages to delete
    const messageList = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.googleAccountId, account.id),
          eq(messages.isDeletedByApp, false),
          inArray(messages.id, messageIds)
        )
      );

    if (messageList.length === 0) {
      return NextResponse.json({ error: "No messages found to delete" }, { status: 404 });
    }

    let deleted = 0;
    let errors = 0;
    const errorsList: string[] = [];
    const totalToDelete = messageList.length;

    // If streaming, create a streaming response
    if (streamProgress) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Delete each message
            for (const message of messageList) {
              try {
                // Trash message in Gmail
                await trashMessage(gmail, message.gmailMessageId);

                // Update message record
                await db
                  .update(messages)
                  .set({
                    isDeletedByApp: true,
                    isManuallyDeleted: true,
                    updatedAt: new Date(),
                  })
                  .where(eq(messages.id, message.id));

                // Record manual deletion for learning
                await recordManualDeletion(userId, message.id, message.sender);

                deleted++;
                
                // Send progress update
                sendProgress(controller, {
                  deleted,
                  total: totalToDelete,
                  remaining: totalToDelete - deleted - errors,
                  errors,
                });
              } catch (error) {
                console.error(`Error deleting message ${message.id}:`, error);
                errors++;
                const errorMsg = `Failed to delete message ${message.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
                errorsList.push(errorMsg);
                
                sendProgress(controller, {
                  deleted,
                  total: totalToDelete,
                  remaining: totalToDelete - deleted - errors,
                  errors,
                });
              }
            }

            // Send final result
            const finalResult = JSON.stringify({
              type: "complete",
              success: true,
              deleted,
              errors,
              total: totalToDelete,
              errorsList: errorsList.length > 0 ? errorsList : undefined,
            }) + "\n";
            controller.enqueue(new TextEncoder().encode(finalResult));
            controller.close();
          } catch (error) {
            const errorResult = JSON.stringify({
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
          "Connection": "keep-alive",
        },
      });
    }

    // Non-streaming path (original implementation)
    // Delete each message
    for (const message of messageList) {
      try {
        // Trash message in Gmail
        await trashMessage(gmail, message.gmailMessageId);

        // Update message record
        await db
          .update(messages)
          .set({
            isDeletedByApp: true,
            isManuallyDeleted: true,
            updatedAt: new Date(),
          })
          .where(eq(messages.id, message.id));

        // Record manual deletion for learning
        await recordManualDeletion(userId, message.id, message.sender);

        deleted++;
      } catch (error) {
        console.error(`Error deleting message ${message.id}:`, error);
        errors++;
        errorsList.push(`Failed to delete message ${message.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      errors,
      total: messageList.length,
      errorsList: errorsList.length > 0 ? errorsList : undefined,
    });
  } catch (error) {
    console.error("Error in manual delete:", error);
    return NextResponse.json(
      { error: "Failed to delete messages", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

