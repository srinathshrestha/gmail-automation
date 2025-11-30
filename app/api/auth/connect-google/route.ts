// Initiate Google OAuth flow for connecting Gmail accounts
// This is separate from user authentication - users must be logged in first

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { OAuth2Client } from "google-auth-library";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get callback URL from query params or use default
    const searchParams = request.nextUrl.searchParams;
    const callbackUrl = searchParams.get("callback") || "/settings";

    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/google-callback`
    );

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["openid", "email", "profile", ...GMAIL_SCOPES].join(" "),
      state: JSON.stringify({
        userId: session.userId,
        callbackUrl,
      }),
    });

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating Google OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate Google OAuth", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

