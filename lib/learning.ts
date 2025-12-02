// Learning system - records user behavior to improve suggestions
// Updates SenderStats based on user actions

import { db, senderStats, messages } from "./db";
import { eq, and } from "drizzle-orm";

/**
 * Record when user confirms deletion of a message (via agent)
 * Increments deletedByAppCount for the sender
 */
export async function recordDeletion(
  userId: string,
  messageId: string,
  sender: string
): Promise<void> {
  // Get message to find googleAccountId
  const messageResult = await db
    .select({ googleAccountId: messages.googleAccountId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (messageResult.length === 0) {
    return;
  }

  const { googleAccountId } = messageResult[0];

  // Check if sender stats exist
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
        deletedByAppCount: existingStats[0].deletedByAppCount + 1,
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
      deletedByAppCount: 1,
      manuallyDeletedCount: 0,
      manuallyKeptCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Record when user manually deletes a message (from messages page)
 * Increments manuallyDeletedCount for the sender
 */
export async function recordManualDeletion(
  userId: string,
  messageId: string,
  sender: string
): Promise<void> {
  // Get message to find googleAccountId
  const messageResult = await db
    .select({ googleAccountId: messages.googleAccountId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (messageResult.length === 0) {
    return;
  }

  const { googleAccountId } = messageResult[0];

  // Check if sender stats exist
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
        manuallyDeletedCount: existingStats[0].manuallyDeletedCount + 1,
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
      deletedByAppCount: 0,
      manuallyDeletedCount: 1,
      manuallyKeptCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Record when user deselects a candidate (keeps it)
 * Increments manuallyKeptCount for the sender
 */
export async function recordKeep(
  userId: string,
  messageId: string,
  sender: string
): Promise<void> {
  // Get message to find googleAccountId
  const messageResult = await db
    .select({ googleAccountId: messages.googleAccountId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (messageResult.length === 0) {
    return;
  }

  const { googleAccountId } = messageResult[0];

  // Check if sender stats exist
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
        manuallyKeptCount: existingStats[0].manuallyKeptCount + 1,
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
      deletedByAppCount: 0,
      manuallyDeletedCount: 0,
      manuallyKeptCount: 1,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Calculate sender penalty score based on keep ratio
 * Higher penalty = more likely to keep emails from this sender
 * Returns a multiplier (0-1) to adjust deleteScore
 */
export async function getSenderPenalty(
  googleAccountId: string,
  sender: string
): Promise<number> {
  const stats = await db
    .select()
    .from(senderStats)
    .where(
      and(
        eq(senderStats.googleAccountId, googleAccountId),
        eq(senderStats.sender, sender)
      )
    )
    .limit(1);

  if (stats.length === 0 || stats[0].totalCount === 0) {
    return 1.0; // No penalty if no data
  }

  return calculatePenalty(stats[0]);
}

/**
 * Batch fetch sender penalties for multiple senders (much faster!)
 * Returns a Map of sender -> penalty score
 */
export async function getBatchSenderPenalties(
  googleAccountId: string,
  senders: string[]
): Promise<Map<string, number>> {
  if (senders.length === 0) {
    return new Map();
  }

  const { inArray } = await import("drizzle-orm");
  
  const stats = await db
    .select()
    .from(senderStats)
    .where(
      and(
        eq(senderStats.googleAccountId, googleAccountId),
        inArray(senderStats.sender, senders)
      )
    );

  const penaltyMap = new Map<string, number>();
  
  // Calculate penalties for all senders at once
  for (const stat of stats) {
    penaltyMap.set(stat.sender, calculatePenalty(stat));
  }

  // Fill in 1.0 (no penalty) for senders with no stats
  for (const sender of senders) {
    if (!penaltyMap.has(sender)) {
      penaltyMap.set(sender, 1.0);
    }
  }

  return penaltyMap;
}

/**
 * Helper to calculate penalty from stats
 */
function calculatePenalty(stat: any): number {
  // Calculate keep ratio (consider both agent deletions and manual deletions)
  const totalActions = stat.manuallyKeptCount + stat.deletedByAppCount + stat.manuallyDeletedCount;
  if (totalActions === 0) {
    return 1.0; // No penalty if no user actions
  }

  // Keep ratio: how often user keeps vs deletes
  const keepRatio = stat.manuallyKeptCount / totalActions;

  // Penalty: if user keeps 80%+ of emails, reduce deleteScore by 50%
  // If user keeps 50%+, reduce by 25%
  // Linear interpolation
  if (keepRatio >= 0.8) {
    return 0.5; // 50% penalty
  } else if (keepRatio >= 0.5) {
    return 0.75; // 25% penalty
  } else {
    return 1.0; // No penalty
  }
}
