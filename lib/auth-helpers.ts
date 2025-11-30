// Authentication helper functions
// Handles user and GoogleAccount creation/updates

import { db, users, googleAccounts } from "./db";
import { encrypt } from "./encryption";
import { eq, and } from "drizzle-orm";

/**
 * Create or update a user based on Google OAuth data
 * Called during sign-in callback
 */
export async function createOrUpdateUser(
  googleId: string,
  email: string
): Promise<{ id: string; email: string }> {
  // Try to find existing user
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleId))
    .limit(1);

  if (existingUser.length > 0) {
    // Update existing user
    const [updated] = await db
      .update(users)
      .set({
        email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser[0].id))
      .returning();

    return { id: updated.id, email: updated.email };
  } else {
    // Create new user
    const now = new Date();
    const [created] = await db
      .insert(users)
      .values({
        googleId,
        email,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return { id: created.id, email: created.email };
  }
}

/**
 * Create or update GoogleAccount with OAuth tokens
 * Encrypts refreshToken before storing
 */
export async function createOrUpdateGoogleAccount(
  userId: string,
  emailAddress: string,
  refreshToken: string,
  accessToken: string | null,
  accessTokenExpiresAt: Date | null,
  scopes: string[]
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

  if (existingAccounts.length > 0) {
    // Update existing account
    const [updated] = await db
      .update(googleAccounts)
      .set({
        refreshToken: encryptedRefreshToken,
        accessToken: encryptedAccessToken,
        accessTokenExpiresAt,
        scopes,
        updatedAt: new Date(),
      })
      .where(eq(googleAccounts.id, existingAccounts[0].id))
      .returning();

    return { id: updated.id, emailAddress: updated.emailAddress };
  } else {
    // Create new account
    const now = new Date();
    const [created] = await db
      .insert(googleAccounts)
      .values({
        userId,
        emailAddress,
        refreshToken: encryptedRefreshToken,
        accessToken: encryptedAccessToken,
        accessTokenExpiresAt,
        scopes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return { id: created.id, emailAddress: created.emailAddress };
  }
}

/**
 * Get GoogleAccount for authenticated user
 * Returns decrypted tokens (caller should handle decryption if needed)
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
        createdAt: googleAccounts.createdAt,
        updatedAt: googleAccounts.updatedAt,
        user: {
          id: users.id,
          email: users.email,
        },
      })
      .from(googleAccounts)
      .innerJoin(users, eq(googleAccounts.userId, users.id))
      .where(eq(googleAccounts.userId, userId))
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
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      user: account.user,
    };
  } catch (error: any) {
    // Handle case where autoIncludeSenders column doesn't exist yet
    if (error?.code === "42703" || error?.message?.includes("autoIncludeSenders")) {
      console.warn("autoIncludeSenders column not found, using empty array. Please run migration.");
      // Try query without autoIncludeSenders
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
            email: users.email,
          },
        })
        .from(googleAccounts)
        .innerJoin(users, eq(googleAccounts.userId, users.id))
        .where(eq(googleAccounts.userId, userId))
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
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        user: account.user,
      };
    }
    throw error;
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
