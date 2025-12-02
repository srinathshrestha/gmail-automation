// Google OAuth callback for connecting Gmail accounts
// Handles the OAuth callback and creates/updates GoogleAccount

import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { connectGoogleAccount } from "@/lib/auth-helpers";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    console.log("Google OAuth callback received:", {
      hasCode: !!code,
      hasState: !!state,
      error: error || "none",
    });

    // Check if Google returned an error
    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=google_oauth_${error}`
      );
    }

    if (!code || !state) {
      console.error("Missing code or state in OAuth callback");
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=oauth_failed`
      );
    }

    // Parse state to get userId and callback URL
    let stateData: { userId: string; callbackUrl: string };
    try {
      stateData = JSON.parse(state);
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=invalid_state`
      );
    }

    // Verify user is still authenticated and matches state
    const session = await getSession();
    if (!session || session.userId !== stateData.userId) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/login?error=session_expired`
      );
    }

    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/google-callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Log token details for debugging
    console.log("OAuth tokens received:", {
      hasRefreshToken: !!tokens.refresh_token,
      hasAccessToken: !!tokens.access_token,
      scopes: tokens.scope,
    });
    
    if (!tokens.refresh_token || !tokens.access_token) {
      console.error("Missing required tokens:", {
        hasRefreshToken: !!tokens.refresh_token,
        hasAccessToken: !!tokens.access_token,
      });
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=no_tokens`
      );
    }

    // Get user info from Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = new OAuth2Client();
    oauth2.setCredentials(tokens);
    const ticket = await oauth2.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload?.email;

    if (!email) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=no_email`
      );
    }

    // Connect the Google account
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : null;

    console.log("Attempting to connect Google account:", {
      userId: stateData.userId,
      email,
      hasTokens: true,
    });

    try {
    await connectGoogleAccount(
      stateData.userId,
      email,
      tokens.refresh_token,
      tokens.access_token,
      expiresAt,
      tokens.scope?.split(" ") || [],
      false // Don't auto-activate, user can choose
    );
      console.log("Successfully connected Google account:", email);
    } catch (connectError) {
      console.error("Failed to connect Google account:", connectError);
      throw connectError; // Re-throw to be caught by outer catch
    }

    // Redirect back to settings with success message
    const callbackUrl = stateData.callbackUrl || "/settings";
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}${callbackUrl}?connected=true&email=${encodeURIComponent(email)}`
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?error=oauth_callback_failed`
    );
  }
}

