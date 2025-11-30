-- Manual migration for multi-account support
-- This migration:
-- 1. Adds username and passwordHash to User table
-- 2. Removes googleId from User table
-- 3. Adds isActive to GoogleAccount table
-- 4. Adds unique constraint on GoogleAccount (userId, emailAddress)

-- Step 1: Add new columns to User table (nullable initially for migration)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" text;

-- Step 2: Migrate existing data - create username from email for existing users
-- This is a temporary migration - users will need to set password on first login
UPDATE "User" 
SET "username" = SPLIT_PART("email", '@', 1) || '_' || SUBSTRING("id" FROM 1 FOR 8)
WHERE "username" IS NULL;

-- Step 3: Make username NOT NULL and unique after data migration
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- Step 4: Remove old unique constraints and column
DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_googleId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "googleId";

-- Step 5: Make email nullable (users can have multiple Gmail accounts)
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Step 6: Add isActive to GoogleAccount
ALTER TABLE "GoogleAccount" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT false;

-- Step 7: Set first GoogleAccount as active for each user (if none is active)
UPDATE "GoogleAccount" ga1
SET "isActive" = true
WHERE NOT EXISTS (
  SELECT 1 FROM "GoogleAccount" ga2 
  WHERE ga2."userId" = ga1."userId" 
  AND ga2."isActive" = true
)
AND ga1."id" = (
  SELECT ga3."id" FROM "GoogleAccount" ga3
  WHERE ga3."userId" = ga1."userId"
  ORDER BY ga3."createdAt" ASC
  LIMIT 1
);

-- Step 8: Add unique constraint on (userId, emailAddress)
-- First, handle any duplicates by keeping the oldest one
DELETE FROM "GoogleAccount" ga1
WHERE ga1."id" NOT IN (
  SELECT MIN(ga2."id")
  FROM "GoogleAccount" ga2
  GROUP BY ga2."userId", ga2."emailAddress"
);

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleAccount_userId_emailAddress_key" 
ON "GoogleAccount"("userId", "emailAddress");

