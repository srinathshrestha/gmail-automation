// Debug endpoint to test Gmail connection
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getGmailClient, listMessages } from "@/lib/gmail-client";
import { getActiveGoogleAccount } from "@/lib/auth-helpers";

export async function GET() {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;

    // Get active GoogleAccount
    const account = await getActiveGoogleAccount(userId);
    if (!account) {
      return NextResponse.json({ error: "No active Google account found. Please connect a Gmail account in settings." }, { status: 404 });
    }

    // Test Gmail client connection
    let gmail;
    try {
      const client = await getGmailClient(userId);
      gmail = client.gmail;
    } catch (error) {
      return NextResponse.json({
        success: false,
        step: "getGmailClient",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      }, { status: 500 });
    }

    // Test listing messages
    try {
      const result = await listMessages(gmail, undefined, 5);
      return NextResponse.json({
        success: true,
        accountId: account.id,
        accountEmail: account.emailAddress,
        messageCount: result.messages?.length || 0,
        messages: result.messages?.slice(0, 3) || [],
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        step: "listMessages",
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? (error as any).response?.data : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      step: "unknown",
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

