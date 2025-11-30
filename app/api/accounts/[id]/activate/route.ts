// Activate a GoogleAccount
// Sets the specified account as active and deactivates all others

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setActiveGoogleAccount } from "@/lib/auth-helpers";

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: googleAccountId } = await params;

    await setActiveGoogleAccount(session.userId, googleAccountId);

    return NextResponse.json({
      success: true,
      message: "Account activated successfully",
    });
  } catch (error) {
    console.error("Error activating account:", error);
    
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to activate account", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

