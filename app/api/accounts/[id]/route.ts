// Delete/disconnect a GoogleAccount
// Removes the account and all associated data

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { disconnectGoogleAccount } from "@/lib/auth-helpers";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const googleAccountId = params.id;

    await disconnectGoogleAccount(session.userId, googleAccountId);

    return NextResponse.json({
      success: true,
      message: "Account disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting account:", error);
    
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to disconnect account", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

