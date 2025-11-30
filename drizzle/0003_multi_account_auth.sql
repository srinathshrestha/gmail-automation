-- Migration for multi-account support with username/password auth
-- Step 1: Add new columns to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" text;

-- Step 2: Migrate existing data - create username from email for existing users
UPDATE "User" 
SET "username" = SPLIT_PART("email", '@', 1) || '_' || SUBSTRING("id" FROM 1 FOR 8)
WHERE "username" IS NULL;

-- Step 3: Make username NOT NULL and unique
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- Step 4: Remove old unique constraints and column
DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_googleId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "googleId";

-- Step 5: Make email nullable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Step 6: Add isActive to GoogleAccount
ALTER TABLE "GoogleAccount" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT false;

-- Step 7: Set first GoogleAccount as active for each user
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

-- Step 8: Handle duplicates and add unique constraint
DELETE FROM "GoogleAccount" ga1
WHERE ga1."id" NOT IN (
  SELECT MIN(ga2."id")
  FROM "GoogleAccount" ga2
  GROUP BY ga2."userId", ga2."emailAddress"
);

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleAccount_userId_emailAddress_key" 
ON "GoogleAccount"("userId", "emailAddress");

