// Account management routes
// List all connected Gmail accounts for the current user

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserGoogleAccounts } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await getUserGoogleAccounts(session.userId);

    return NextResponse.json({
      success: true,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        emailAddress: acc.emailAddress,
        isActive: acc.isActive,
        autoIncludeSenders: acc.autoIncludeSenders || [],
        createdAt: acc.createdAt.toISOString(),
        updatedAt: acc.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

