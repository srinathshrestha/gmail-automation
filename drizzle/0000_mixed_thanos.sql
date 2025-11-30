CREATE TYPE "public"."aiCategory" AS ENUM('unknown', 'personal', 'work', 'receipt', 'promo', 'notification', 'spamLike');--> statement-breakpoint
CREATE TYPE "public"."deleteBatchStatus" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deleteDecision" AS ENUM('deleted', 'skipped', 'error');--> statement-breakpoint
CREATE TABLE "DeleteBatchItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deleteBatchId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"gmailMessageId" text NOT NULL,
	"decision" "deleteDecision" NOT NULL,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DeleteBatch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"googleAccountId" uuid NOT NULL,
	"totalCandidates" integer NOT NULL,
	"totalDeleted" integer DEFAULT 0 NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"finishedAt" timestamp,
	"status" "deleteBatchStatus" DEFAULT 'pending' NOT NULL,
	"errorMessage" text
);
--> statement-breakpoint
CREATE TABLE "GoogleAccount" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"emailAddress" text NOT NULL,
	"refreshToken" text NOT NULL,
	"accessToken" text,
	"accessTokenExpiresAt" timestamp,
	"scopes" text[] NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"googleAccountId" uuid NOT NULL,
	"gmailMessageId" text NOT NULL,
	"gmailThreadId" text NOT NULL,
	"sender" text NOT NULL,
	"senderName" text,
	"subject" text NOT NULL,
	"snippet" text NOT NULL,
	"internalDate" timestamp NOT NULL,
	"labels" text[] NOT NULL,
	"hasUserReplied" boolean DEFAULT false NOT NULL,
	"aiCategory" "aiCategory" DEFAULT 'unknown' NOT NULL,
	"aiDeleteScore" real,
	"aiDeleteReason" text,
	"isDeleteCandidate" boolean DEFAULT false NOT NULL,
	"isDeletedByApp" boolean DEFAULT false NOT NULL,
	"isManuallyKept" boolean DEFAULT false NOT NULL,
	"isManuallyDeleted" boolean DEFAULT false NOT NULL,
	"lastSyncedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SenderStats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"googleAccountId" uuid NOT NULL,
	"sender" text NOT NULL,
	"totalCount" integer DEFAULT 0 NOT NULL,
	"deletedByAppCount" integer DEFAULT 0 NOT NULL,
	"manuallyDeletedCount" integer DEFAULT 0 NOT NULL,
	"manuallyKeptCount" integer DEFAULT 0 NOT NULL,
	"lastEmailAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"googleId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email"),
	CONSTRAINT "User_googleId_unique" UNIQUE("googleId")
);
--> statement-breakpoint
ALTER TABLE "DeleteBatchItem" ADD CONSTRAINT "DeleteBatchItem_deleteBatchId_DeleteBatch_id_fk" FOREIGN KEY ("deleteBatchId") REFERENCES "public"."DeleteBatch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DeleteBatchItem" ADD CONSTRAINT "DeleteBatchItem_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DeleteBatch" ADD CONSTRAINT "DeleteBatch_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DeleteBatch" ADD CONSTRAINT "DeleteBatch_googleAccountId_GoogleAccount_id_fk" FOREIGN KEY ("googleAccountId") REFERENCES "public"."GoogleAccount"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GoogleAccount" ADD CONSTRAINT "GoogleAccount_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_googleAccountId_GoogleAccount_id_fk" FOREIGN KEY ("googleAccountId") REFERENCES "public"."GoogleAccount"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SenderStats" ADD CONSTRAINT "SenderStats_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SenderStats" ADD CONSTRAINT "SenderStats_googleAccountId_GoogleAccount_id_fk" FOREIGN KEY ("googleAccountId") REFERENCES "public"."GoogleAccount"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "DeleteBatchItem_deleteBatchId_idx" ON "DeleteBatchItem" USING btree ("deleteBatchId");--> statement-breakpoint
CREATE INDEX "DeleteBatchItem_messageId_idx" ON "DeleteBatchItem" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "DeleteBatch_userId_idx" ON "DeleteBatch" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "DeleteBatch_googleAccountId_idx" ON "DeleteBatch" USING btree ("googleAccountId");--> statement-breakpoint
CREATE INDEX "GoogleAccount_userId_idx" ON "GoogleAccount" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "Message_googleAccountId_gmailMessageId_key" ON "Message" USING btree ("googleAccountId","gmailMessageId");--> statement-breakpoint
CREATE INDEX "Message_userId_idx" ON "Message" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Message_googleAccountId_idx" ON "Message" USING btree ("googleAccountId");--> statement-breakpoint
CREATE INDEX "Message_isDeleteCandidate_isDeletedByApp_idx" ON "Message" USING btree ("isDeleteCandidate","isDeletedByApp");--> statement-breakpoint
CREATE INDEX "Message_internalDate_idx" ON "Message" USING btree ("internalDate");--> statement-breakpoint
CREATE UNIQUE INDEX "SenderStats_googleAccountId_sender_key" ON "SenderStats" USING btree ("googleAccountId","sender");--> statement-breakpoint
CREATE INDEX "SenderStats_userId_idx" ON "SenderStats" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "SenderStats_googleAccountId_idx" ON "SenderStats" USING btree ("googleAccountId");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "User_googleId_key" ON "User" USING btree ("googleId");