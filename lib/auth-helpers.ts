// Authentication helper functions
// Handles user and GoogleAccount creation/updates

import { db, users, googleAccounts } from "./db";
import { encrypt, decrypt } from "./encryption";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new user with username and password
 */
export async function createUser(
  username: string,
  password: string,
  email?: string
): Promise<{ id: string; username: string; email: string | null }> {
  // Check if username already exists
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser.length > 0) {
    throw new Error("Username already exists");
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const now = new Date();
  const [created] = await db
    .insert(users)
    .values({
      username,
      passwordHash,
      email: email || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    id: created.id,
    username: created.username,
    email: created.email,
  };
}

/**
 * Authenticate a user with username and password
 * Returns user if credentials are valid, null otherwise
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ id: string; username: string; email: string | null } | null> {
  // Find user by username
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (userResult.length === 0) {
    return null;
  }

  const user = userResult[0];

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
  };
}

/**
 * Create or update GoogleAccount with OAuth tokens
 * Encrypts refreshToken before storing
 * If setAsActive is true, sets this account as active and deactivates others
 */
export async function createOrUpdateGoogleAccount(
  userId: string,
  emailAddress: string,
  refreshToken: string,
  accessToken: string | null,
  accessTokenExpiresAt: Date | null,
  scopes: string[],
  setAsActive: boolean = false
): Promise<{ id: string; emailAddress: string }> {
  // Encrypt the refresh token before storing
  const encryptedRefreshToken = encrypt(refreshToken);
  
  // Encrypt access token if provided
  const encryptedAccessToken = accessToken ? encrypt(accessToken) : null;

  // Find existing account by userId and emailAddress
  const existingAccounts = await db
    .select()
    .from(googleAccounts)
    .where(
      and(
        eq(googleAccounts.userId, userId),
        eq(googleAccounts.emailAddress, emailAddress)
      )
    )
    .limit(1);

  const now = new Date();

  if (existingAccounts.length > 0) {
    // Update existing account
    const updateData: any = {
      refreshToken: encryptedRefreshToken,
      accessToken: encryptedAccessToken,
      accessTokenExpiresAt,
      scopes,
      updatedAt: now,
    };

    // If setAsActive, also update isActive flag
    if (setAsActive) {
      // Deactivate all other accounts for this user
      await db
        .update(googleAccounts)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(googleAccounts.userId, userId),
            eq(googleAccounts.id, existingAccounts[0].id)
          )
        );
      updateData.isActive = true;
    }

    const [updated] = await db
      .update(googleAccounts)
      .set(updateData)
      .where(eq(googleAccounts.id, existingAccounts[0].id))
      .returning();

    return { id: updated.id, emailAddress: updated.emailAddress };
  } else {
    // Create new account
    // If this is the first account or setAsActive is true, make it active
    const allAccounts = await db
      .select()
      .from(googleAccounts)
      .where(eq(googleAccounts.userId, userId));

    const isFirstAccount = allAccounts.length === 0;
    const shouldBeActive = setAsActive || isFirstAccount;

    // If setting as active, deactivate all other accounts
    if (shouldBeActive && !isFirstAccount) {
      await db
        .update(googleAccounts)
        .set({ isActive: false, updatedAt: now })
        .where(eq(googleAccounts.userId, userId));
    }

    const [created] = await db
      .insert(googleAccounts)
      .values({
        userId,
        emailAddress,
        refreshToken: encryptedRefreshToken,
        accessToken: encryptedAccessToken,
        accessTokenExpiresAt,
        scopes,
        isActive: shouldBeActive,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return { id: created.id, emailAddress: created.emailAddress };
  }
}

/**
 * Get all GoogleAccounts for a user
 */
export async function getUserGoogleAccounts(userId: string) {
  const accounts = await db
    .select({
      id: googleAccounts.id,
      userId: googleAccounts.userId,
      emailAddress: googleAccounts.emailAddress,
      isActive: googleAccounts.isActive,
      autoIncludeSenders: googleAccounts.autoIncludeSenders,
      createdAt: googleAccounts.createdAt,
      updatedAt: googleAccounts.updatedAt,
    })
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId))
    .orderBy(googleAccounts.createdAt);

  return accounts;
}

/**
 * Get the currently active GoogleAccount for a user
 * Returns decrypted tokens (caller should handle decryption if needed)
 */
export async function getActiveGoogleAccount(userId: string) {
  try {
    const accounts = await db
      .select({
        id: googleAccounts.id,
        userId: googleAccounts.userId,
        emailAddress: googleAccounts.emailAddress,
        refreshToken: googleAccounts.refreshToken,
        accessToken: googleAccounts.accessToken,
        accessTokenExpiresAt: googleAccounts.accessTokenExpiresAt,
        scopes: googleAccounts.scopes,
        autoIncludeSenders: googleAccounts.autoIncludeSenders,
        isActive: googleAccounts.isActive,
        createdAt: googleAccounts.createdAt,
        updatedAt: googleAccounts.updatedAt,
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
        },
      })
      .from(googleAccounts)
      .innerJoin(users, eq(googleAccounts.userId, users.id))
      .where(
        and(
          eq(googleAccounts.userId, userId),
          eq(googleAccounts.isActive, true)
        )
      )
      .limit(1);

    if (accounts.length === 0) {
      return null;
    }

    const account = accounts[0];
    return {
      id: account.id,
      userId: account.userId,
      emailAddress: account.emailAddress,
      refreshToken: account.refreshToken,
      accessToken: account.accessToken,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
      scopes: account.scopes,
      autoIncludeSenders: account.autoIncludeSenders || [],
      isActive: account.isActive,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      user: account.user,
    };
  } catch (error: any) {
    // Handle case where isActive or autoIncludeSenders column doesn't exist yet
    if (
      error?.code === "42703" ||
      error?.message?.includes("isActive") ||
      error?.message?.includes("autoIncludeSenders")
    ) {
      console.warn(
        "isActive or autoIncludeSenders column not found. Please run migration."
      );
      // Fallback to old behavior - get first account
      return getUserGoogleAccount(userId);
    }
    throw error;
  }
}

/**
 * Get GoogleAccount for authenticated user (legacy - returns first account)
 * Returns decrypted tokens (caller should handle decryption if needed)
 * @deprecated Use getActiveGoogleAccount() instead
 */
export async function getUserGoogleAccount(userId: string) {
  try {
    const accounts = await db
      .select({
        id: googleAccounts.id,
        userId: googleAccounts.userId,
        emailAddress: googleAccounts.emailAddress,
        refreshToken: googleAccounts.refreshToken,
        accessToken: googleAccounts.accessToken,
        accessTokenExpiresAt: googleAccounts.accessTokenExpiresAt,
        scopes: googleAccounts.scopes,
        autoIncludeSenders: googleAccounts.autoIncludeSenders,
        isActive: googleAccounts.isActive,
        createdAt: googleAccounts.createdAt,
        updatedAt: googleAccounts.updatedAt,
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
        },
      })
      .from(googleAccounts)
      .innerJoin(users, eq(googleAccounts.userId, users.id))
      .where(eq(googleAccounts.userId, userId))
      .orderBy(googleAccounts.createdAt)
      .limit(1);

    if (accounts.length === 0) {
      return null;
    }

    const account = accounts[0];
    return {
      id: account.id,
      userId: account.userId,
      emailAddress: account.emailAddress,
      refreshToken: account.refreshToken,
      accessToken: account.accessToken,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
      scopes: account.scopes,
      autoIncludeSenders: account.autoIncludeSenders || [],
      isActive: account.isActive,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      user: account.user,
    };
  } catch (error: any) {
    // Handle case where autoIncludeSenders or isActive column doesn't exist yet
    if (
      error?.code === "42703" ||
      error?.message?.includes("autoIncludeSenders") ||
      error?.message?.includes("isActive")
    ) {
      console.warn(
        "autoIncludeSenders or isActive column not found. Please run migration."
      );
      // Try query without these columns
      const accounts = await db
        .select({
          id: googleAccounts.id,
          userId: googleAccounts.userId,
          emailAddress: googleAccounts.emailAddress,
          refreshToken: googleAccounts.refreshToken,
          accessToken: googleAccounts.accessToken,
          accessTokenExpiresAt: googleAccounts.accessTokenExpiresAt,
          scopes: googleAccounts.scopes,
          createdAt: googleAccounts.createdAt,
          updatedAt: googleAccounts.updatedAt,
          user: {
            id: users.id,
            username: users.username,
            email: users.email,
          },
        })
        .from(googleAccounts)
        .innerJoin(users, eq(googleAccounts.userId, users.id))
        .where(eq(googleAccounts.userId, userId))
        .orderBy(googleAccounts.createdAt)
        .limit(1);

      if (accounts.length === 0) {
        return null;
      }

      const account = accounts[0];
      return {
        id: account.id,
        userId: account.userId,
        emailAddress: account.emailAddress,
        refreshToken: account.refreshToken,
        accessToken: account.accessToken,
        accessTokenExpiresAt: account.accessTokenExpiresAt,
        scopes: account.scopes,
        autoIncludeSenders: [], // Default to empty array
        isActive: false, // Default to false
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        user: account.user,
      };
    }
    throw error;
  }
}

/**
 * Set a GoogleAccount as active for a user
 * Deactivates all other accounts for that user
 */
export async function setActiveGoogleAccount(
  userId: string,
  googleAccountId: string
): Promise<void> {
  // Verify the account belongs to the user
  const accountResult = await db
    .select()
    .from(googleAccounts)
    .where(
      and(
        eq(googleAccounts.id, googleAccountId),
        eq(googleAccounts.userId, userId)
      )
    )
    .limit(1);

  if (accountResult.length === 0) {
    throw new Error("GoogleAccount not found or does not belong to user");
  }

  const now = new Date();

  // Deactivate all accounts for this user
  await db
    .update(googleAccounts)
    .set({ isActive: false, updatedAt: now })
    .where(eq(googleAccounts.userId, userId));

  // Activate the specified account
  await db
    .update(googleAccounts)
    .set({ isActive: true, updatedAt: now })
    .where(eq(googleAccounts.id, googleAccountId));
}

/**
 * Connect a new GoogleAccount to a user
 * This is a wrapper around createOrUpdateGoogleAccount with better naming
 */
export async function connectGoogleAccount(
  userId: string,
  emailAddress: string,
  refreshToken: string,
  accessToken: string | null,
  accessTokenExpiresAt: Date | null,
  scopes: string[],
  setAsActive: boolean = false
): Promise<{ id: string; emailAddress: string }> {
  return createOrUpdateGoogleAccount(
    userId,
    emailAddress,
    refreshToken,
    accessToken,
    accessTokenExpiresAt,
    scopes,
    setAsActive
  );
}

/**
 * Disconnect a GoogleAccount from a user
 */
export async function disconnectGoogleAccount(
  userId: string,
  googleAccountId: string
): Promise<void> {
  // Verify the account belongs to the user
  const accountResult = await db
    .select()
    .from(googleAccounts)
    .where(
      and(
        eq(googleAccounts.id, googleAccountId),
        eq(googleAccounts.userId, userId)
      )
    )
    .limit(1);

  if (accountResult.length === 0) {
    throw new Error("GoogleAccount not found or does not belong to user");
  }

  // Delete the account (cascade will handle related data)
  await db
    .delete(googleAccounts)
    .where(eq(googleAccounts.id, googleAccountId));

  // If this was the active account, set another one as active (if any exist)
  if (accountResult[0].isActive) {
    const remainingAccounts = await db
      .select()
      .from(googleAccounts)
      .where(eq(googleAccounts.userId, userId))
      .orderBy(googleAccounts.createdAt)
      .limit(1);

    if (remainingAccounts.length > 0) {
      await db
        .update(googleAccounts)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(googleAccounts.id, remainingAccounts[0].id));
    }
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0] || null;
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return result[0] || null;
}
