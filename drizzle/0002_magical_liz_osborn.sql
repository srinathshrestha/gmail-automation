CREATE TYPE "public"."syncStatus" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'timeout');--> statement-breakpoint
CREATE TABLE "SyncProgress" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"googleAccountId" uuid NOT NULL,
	"status" "syncStatus" DEFAULT 'pending' NOT NULL,
	"totalMessages" integer DEFAULT 0 NOT NULL,
	"processedMessages" integer DEFAULT 0 NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"nextPageToken" text,
	"errorMessage" text,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "SyncProgress" ADD CONSTRAINT "SyncProgress_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SyncProgress" ADD CONSTRAINT "SyncProgress_googleAccountId_GoogleAccount_id_fk" FOREIGN KEY ("googleAccountId") REFERENCES "public"."GoogleAccount"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "SyncProgress_userId_idx" ON "SyncProgress" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "SyncProgress_googleAccountId_idx" ON "SyncProgress" USING btree ("googleAccountId");--> statement-breakpoint
CREATE INDEX "SyncProgress_status_idx" ON "SyncProgress" USING btree ("status");