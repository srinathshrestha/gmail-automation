// User data deletion route
// Deletes all user data from the database

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  db,
  deleteBatchItems,
  deleteBatches,
  messages,
  senderStats,
  googleAccounts,
  users,
} from "@/lib/db";
import { eq, inArray } from "drizzle-orm";

export async function POST() {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;

    // Delete all user data in correct order (respecting foreign keys)
    // Order: DeleteBatchItem → DeleteBatch → Message → SenderStats → GoogleAccount → User

    // Get all related IDs first
    // Delete DeleteBatchItems
    const deleteBatchesList = await db
      .select({ id: deleteBatches.id })
      .from(deleteBatches)
      .where(eq(deleteBatches.userId, userId));

    const deleteBatchIds = deleteBatchesList.map((batch) => batch.id);

    if (deleteBatchIds.length > 0) {
      await db
        .delete(deleteBatchItems)
        .where(inArray(deleteBatchItems.deleteBatchId, deleteBatchIds));
    }

    // Delete DeleteBatches
    await db.delete(deleteBatches).where(eq(deleteBatches.userId, userId));

    // Delete Messages
    await db.delete(messages).where(eq(messages.userId, userId));

    // Delete SenderStats
    await db.delete(senderStats).where(eq(senderStats.userId, userId));

    // Delete GoogleAccounts
    await db.delete(googleAccounts).where(eq(googleAccounts.userId, userId));

    // Finally, delete User
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      message: "All user data has been deleted",
    });
  } catch (error) {
    console.error("Error deleting user data:", error);
    return NextResponse.json(
      {
        error: "Failed to delete user data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
