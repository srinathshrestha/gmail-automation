ALTER TABLE "DeleteBatchItem" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "DeleteBatch" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "GoogleAccount" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Message" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "SenderStats" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "GoogleAccount" ADD COLUMN "autoIncludeSenders" text[] DEFAULT '{}' NOT NULL;