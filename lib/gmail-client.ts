// Gmail API client wrapper
// Handles authentication, token refresh, and Gmail API calls

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { getActiveGoogleAccount } from "./auth-helpers";
import { decrypt, encrypt } from "./encryption";
import { db, googleAccounts } from "./db";
import { eq } from "drizzle-orm";

/**
 * Get authenticated Gmail client for a user
 * Handles token refresh automatically
 */
export async function getGmailClient(userId: string): Promise<{
  gmail: ReturnType<typeof google.gmail>;
  oauth2Client: OAuth2Client;
}> {
  // Load active GoogleAccount from database
  const account = await getActiveGoogleAccount(userId);
  if (!account) {
    throw new Error("No active Google account found for user");
  }

  // Decrypt refresh token
  let refreshToken: string;
  try {
    refreshToken = decrypt(account.refreshToken);
  } catch (error) {
    console.error("Error decrypting refresh token:", error);
    throw new Error("Failed to decrypt refresh token. Please sign out and sign in again.");
  }
  
  // Decrypt access token if available and not expired
  let accessToken: string | null = null;
  if (account.accessToken && account.accessTokenExpiresAt) {
    const now = new Date();
    if (account.accessTokenExpiresAt > now) {
      try {
        accessToken = decrypt(account.accessToken);
      } catch (error) {
        console.error("Error decrypting access token (will refresh):", error);
        // Continue without cached access token - will refresh below
        accessToken = null;
      }
    }
  }

  // Create OAuth2 client
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback/google"
  );

  // Set credentials
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken || undefined,
  });

  // Refresh token if needed
  if (!accessToken || (account.accessTokenExpiresAt && account.accessTokenExpiresAt <= new Date())) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update database with new access token
      const encryptedAccessToken = credentials.access_token
        ? encrypt(credentials.access_token)
        : null;
      const expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : null;

      await db
        .update(googleAccounts)
        .set({
          accessToken: encryptedAccessToken,
          accessTokenExpiresAt: expiresAt,
        })
        .where(eq(googleAccounts.id, account.id));
    } catch (error) {
      console.error("Error refreshing access token:", error);
      throw new Error("Failed to refresh access token");
    }
  }

  // Create Gmail client
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  return { gmail, oauth2Client };
}

/**
 * List messages from Gmail
 * Returns message IDs with pagination support
 * @param pageToken - Optional pagination token to resume from a specific page
 */
export async function listMessages(
  gmail: ReturnType<typeof google.gmail>,
  query?: string,
  maxResults: number = 500,
  pageToken?: string
): Promise<{ messages: Array<{ id: string; threadId: string }>; nextPageToken?: string }> {
  try {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
      pageToken: pageToken, // Support pagination token
    });

    // Filter out messages without required fields and map to expected type
    const validMessages = (response.data.messages || [])
      .filter(
        (msg): msg is { id: string; threadId: string } =>
          typeof msg.id === "string" && typeof msg.threadId === "string"
      )
      .map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
      }));

    return {
      messages: validMessages,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  } catch (error: unknown) {
    // Check for Gmail API not enabled error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const hasErrorCode = (err: unknown): err is { code?: number } => {
      return typeof err === "object" && err !== null && "code" in err;
    };
    if (
      errorMessage.includes("Gmail API has not been used") ||
      errorMessage.includes("it is disabled") ||
      (hasErrorCode(error) && error.code === 403)
    ) {
      // Extract project ID from error if available
      const projectIdMatch = errorMessage.match(/project\s+(\d+)/);
      const projectId = projectIdMatch ? projectIdMatch[1] : null;

      const enableUrl = projectId
        ? `https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=${projectId}`
        : "https://console.developers.google.com/apis/library/gmail.googleapis.com";

      const enhancedError = new Error(
        `Gmail API is not enabled for your Google Cloud project. ` +
          `Please enable it in Google Cloud Console: ${enableUrl}`
      ) as Error & {
        code: number;
        apiNotEnabled: boolean;
        enableUrl: string;
        projectId: string | null;
      };
      enhancedError.code = 403;
      enhancedError.apiNotEnabled = true;
      enhancedError.enableUrl = enableUrl;
      enhancedError.projectId = projectId;
      throw enhancedError;
    }
    throw error;
  }
}

/**
 * Get message metadata (format=metadata)
 * Returns headers, labels, snippet, etc.
 */
export async function getMessageMetadata(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
): Promise<{
  id: string;
  threadId: string;
  snippet: string;
  internalDate: number;
  labels: string[];
  headers: Record<string, string>;
}> {
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Date"],
  });

  const message = response.data;
  if (!message) {
    throw new Error(`Message ${messageId} not found`);
  }

  // Parse headers into object
  const headers: Record<string, string> = {};
  if (message.payload?.headers) {
    for (const header of message.payload.headers) {
      if (header.name && header.value) {
        headers[header.name.toLowerCase()] = header.value;
      }
    }
  }

  return {
    id: message.id!,
    threadId: message.threadId!,
    snippet: message.snippet || "",
    internalDate: parseInt(message.internalDate || "0", 10),
    labels: message.labelIds || [],
    headers,
  };
}

/**
 * Get thread details to check if user replied
 * Checks if user's email appears in thread senders
 */
export async function getThreadDetails(
  gmail: ReturnType<typeof google.gmail>,
  threadId: string,
  userEmail: string
): Promise<{ hasUserReplied: boolean }> {
  try {
    const response = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: ["From"],
    });

    const thread = response.data;
    if (!thread.messages) {
      return { hasUserReplied: false };
    }

    // Check if any message in thread is from the user
    // Also check for SENT label
    const hasUserReplied = thread.messages.some((message) => {
      // Check labels for SENT
      if (message.labelIds?.includes("SENT")) {
        return true;
      }

      // Check From header
      const fromHeader = message.payload?.headers?.find(
        (h) => h.name?.toLowerCase() === "from"
      );
      if (fromHeader?.value?.includes(userEmail)) {
        return true;
      }

      return false;
    });

    return { hasUserReplied };
  } catch (error) {
    console.error(`Error checking thread ${threadId}:`, error);
    return { hasUserReplied: false };
  }
}

/**
 * Move message to trash
 */
export async function trashMessage(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
): Promise<void> {
  await gmail.users.messages.trash({
    userId: "me",
    id: messageId,
  });
}

/**
 * Parse sender email and name from "From" header
 * Format: "Name <email@example.com>" or "email@example.com"
 */
export function parseSender(fromHeader: string): {
  email: string;
  name: string | null;
} {
  const match = fromHeader.match(/^(.+?)\s*<(.+?)>$|^(.+?)$/);
  if (match) {
    if (match[2]) {
      // Format: "Name <email@example.com>"
      return {
        email: match[2].trim(),
        name: match[1].trim() || null,
      };
    } else if (match[3]) {
      // Format: "email@example.com"
      return {
        email: match[3].trim(),
        name: null,
      };
    }
  }
  
  // Fallback
  return {
    email: fromHeader.trim(),
    name: null,
  };
}

