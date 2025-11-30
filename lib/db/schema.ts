// Drizzle schema for InboxJanitor
// Database: Neon Postgres

import { pgTable, text, timestamp, boolean, integer, real, pgEnum, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { randomUUID } from "crypto";

// Enums
export const aiCategoryEnum = pgEnum("aiCategory", [
  "unknown",
  "personal",
  "work",
  "receipt",
  "promo",
  "notification",
  "spamLike",
]);

export const deleteBatchStatusEnum = pgEnum("deleteBatchStatus", [
  "pending",
  "completed",
  "failed",
]);

export const deleteDecisionEnum = pgEnum("deleteDecision", [
  "deleted",
  "skipped",
  "error",
]);

export const syncStatusEnum = pgEnum("syncStatus", [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "timeout",
]);

// User table
export const users = pgTable(
  "User",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    email: text("email").notNull().unique(),
    googleId: text("googleId").notNull().unique(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("User_email_key").on(table.email),
    googleIdIdx: uniqueIndex("User_googleId_key").on(table.googleId),
  })
);

// GoogleAccount table
export const googleAccounts = pgTable(
  "GoogleAccount",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailAddress: text("emailAddress").notNull(),
    refreshToken: text("refreshToken").notNull(), // Encrypted at rest
    accessToken: text("accessToken"), // Optional cache, short-lived
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    scopes: text("scopes").array().notNull(), // Postgres text array
    autoIncludeSenders: text("autoIncludeSenders").array().notNull().default([]), // Senders to auto-include in suggestions
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("GoogleAccount_userId_idx").on(table.userId),
  })
);

// Message table
export const messages = pgTable(
  "Message",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    googleAccountId: uuid("googleAccountId")
      .notNull()
      .references(() => googleAccounts.id, { onDelete: "cascade" }),
    gmailMessageId: text("gmailMessageId").notNull(),
    gmailThreadId: text("gmailThreadId").notNull(),
    sender: text("sender").notNull(),
    senderName: text("senderName"),
    subject: text("subject").notNull(),
    snippet: text("snippet").notNull(),
    internalDate: timestamp("internalDate").notNull(),
    labels: text("labels").array().notNull(),
    hasUserReplied: boolean("hasUserReplied").notNull().default(false),
    aiCategory: aiCategoryEnum("aiCategory").notNull().default("unknown"),
    aiDeleteScore: real("aiDeleteScore"), // 0-1, null if not evaluated
    aiDeleteReason: text("aiDeleteReason"),
    isDeleteCandidate: boolean("isDeleteCandidate").notNull().default(false),
    isDeletedByApp: boolean("isDeletedByApp").notNull().default(false),
    isManuallyKept: boolean("isManuallyKept").notNull().default(false),
    isManuallyDeleted: boolean("isManuallyDeleted").notNull().default(false),
    lastSyncedAt: timestamp("lastSyncedAt").notNull().defaultNow(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    uniqueMessageIdx: uniqueIndex("Message_googleAccountId_gmailMessageId_key").on(
      table.googleAccountId,
      table.gmailMessageId
    ),
    userIdIdx: index("Message_userId_idx").on(table.userId),
    googleAccountIdIdx: index("Message_googleAccountId_idx").on(table.googleAccountId),
    candidateIdx: index("Message_isDeleteCandidate_isDeletedByApp_idx").on(
      table.isDeleteCandidate,
      table.isDeletedByApp
    ),
    internalDateIdx: index("Message_internalDate_idx").on(table.internalDate),
  })
);

// SenderStats table
export const senderStats = pgTable(
  "SenderStats",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    googleAccountId: uuid("googleAccountId")
      .notNull()
      .references(() => googleAccounts.id, { onDelete: "cascade" }),
    sender: text("sender").notNull(),
    totalCount: integer("totalCount").notNull().default(0),
    deletedByAppCount: integer("deletedByAppCount").notNull().default(0),
    manuallyDeletedCount: integer("manuallyDeletedCount").notNull().default(0),
    manuallyKeptCount: integer("manuallyKeptCount").notNull().default(0),
    lastEmailAt: timestamp("lastEmailAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    uniqueSenderIdx: uniqueIndex("SenderStats_googleAccountId_sender_key").on(
      table.googleAccountId,
      table.sender
    ),
    userIdIdx: index("SenderStats_userId_idx").on(table.userId),
    googleAccountIdIdx: index("SenderStats_googleAccountId_idx").on(table.googleAccountId),
  })
);

// DeleteBatch table
export const deleteBatches = pgTable(
  "DeleteBatch",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    googleAccountId: uuid("googleAccountId")
      .notNull()
      .references(() => googleAccounts.id, { onDelete: "cascade" }),
    totalCandidates: integer("totalCandidates").notNull(),
    totalDeleted: integer("totalDeleted").notNull().default(0),
    startedAt: timestamp("startedAt").notNull().defaultNow(),
    finishedAt: timestamp("finishedAt"),
    status: deleteBatchStatusEnum("status").notNull().default("pending"),
    errorMessage: text("errorMessage"),
  },
  (table) => ({
    userIdIdx: index("DeleteBatch_userId_idx").on(table.userId),
    googleAccountIdIdx: index("DeleteBatch_googleAccountId_idx").on(table.googleAccountId),
  })
);

// DeleteBatchItem table
export const deleteBatchItems = pgTable(
  "DeleteBatchItem",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    deleteBatchId: uuid("deleteBatchId")
      .notNull()
      .references(() => deleteBatches.id, { onDelete: "cascade" }),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    gmailMessageId: text("gmailMessageId").notNull(),
    decision: deleteDecisionEnum("decision").notNull(),
    reason: text("reason"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    deleteBatchIdIdx: index("DeleteBatchItem_deleteBatchId_idx").on(table.deleteBatchId),
    messageIdIdx: index("DeleteBatchItem_messageId_idx").on(table.messageId),
  })
);

// SyncProgress table - tracks Gmail sync progress to handle timeouts
export const syncProgress = pgTable(
  "SyncProgress",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    googleAccountId: uuid("googleAccountId")
      .notNull()
      .references(() => googleAccounts.id, { onDelete: "cascade" }),
    status: syncStatusEnum("status").notNull().default("pending"),
    totalMessages: integer("totalMessages").notNull().default(0), // Total messages to sync
    processedMessages: integer("processedMessages").notNull().default(0), // Messages processed so far
    created: integer("created").notNull().default(0), // New messages created
    updated: integer("updated").notNull().default(0), // Existing messages updated
    errors: integer("errors").notNull().default(0), // Errors encountered
    nextPageToken: text("nextPageToken"), // Gmail API pagination token to resume from
    errorMessage: text("errorMessage"), // Error message if sync failed
    startedAt: timestamp("startedAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    completedAt: timestamp("completedAt"), // When sync completed or failed
  },
  (table) => ({
    userIdIdx: index("SyncProgress_userId_idx").on(table.userId),
    googleAccountIdIdx: index("SyncProgress_googleAccountId_idx").on(table.googleAccountId),
    statusIdx: index("SyncProgress_status_idx").on(table.status),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  googleAccounts: many(googleAccounts),
  messages: many(messages),
  senderStats: many(senderStats),
  deleteBatches: many(deleteBatches),
  syncProgress: many(syncProgress),
}));

export const googleAccountsRelations = relations(googleAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [googleAccounts.userId],
    references: [users.id],
  }),
  messages: many(messages),
  senderStats: many(senderStats),
  deleteBatches: many(deleteBatches),
  syncProgress: many(syncProgress),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  googleAccount: one(googleAccounts, {
    fields: [messages.googleAccountId],
    references: [googleAccounts.id],
  }),
  deleteBatchItems: many(deleteBatchItems),
}));

export const senderStatsRelations = relations(senderStats, ({ one }) => ({
  user: one(users, {
    fields: [senderStats.userId],
    references: [users.id],
  }),
  googleAccount: one(googleAccounts, {
    fields: [senderStats.googleAccountId],
    references: [googleAccounts.id],
  }),
}));

export const deleteBatchesRelations = relations(deleteBatches, ({ one, many }) => ({
  user: one(users, {
    fields: [deleteBatches.userId],
    references: [users.id],
  }),
  googleAccount: one(googleAccounts, {
    fields: [deleteBatches.googleAccountId],
    references: [googleAccounts.id],
  }),
  items: many(deleteBatchItems),
}));

export const deleteBatchItemsRelations = relations(deleteBatchItems, ({ one }) => ({
  deleteBatch: one(deleteBatches, {
    fields: [deleteBatchItems.deleteBatchId],
    references: [deleteBatches.id],
  }),
  message: one(messages, {
    fields: [deleteBatchItems.messageId],
    references: [messages.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type GoogleAccount = typeof googleAccounts.$inferSelect;
export type NewGoogleAccount = typeof googleAccounts.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type SenderStats = typeof senderStats.$inferSelect;
export type NewSenderStats = typeof senderStats.$inferInsert;
export type DeleteBatch = typeof deleteBatches.$inferSelect;
export type NewDeleteBatch = typeof deleteBatches.$inferInsert;
export type DeleteBatchItem = typeof deleteBatchItems.$inferSelect;
export type NewDeleteBatchItem = typeof deleteBatchItems.$inferInsert;
export type SyncProgress = typeof syncProgress.$inferSelect;
export type NewSyncProgress = typeof syncProgress.$inferInsert;

