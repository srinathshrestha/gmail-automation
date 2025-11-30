// API route for managing auto-include senders
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserGoogleAccount } from "@/lib/auth-helpers";
import { db, googleAccounts } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await getUserGoogleAccount(session.user.id);
    if (!account) {
      return NextResponse.json(
        { error: "No Google account found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      senders: account.autoIncludeSenders || [],
    });
  } catch (error) {
    console.error("Error fetching auto-include senders:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch auto-include senders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { senders } = body;

    if (!Array.isArray(senders)) {
      return NextResponse.json(
        { error: "senders must be an array" },
        { status: 400 }
      );
    }

    const account = await getUserGoogleAccount(session.user.id);
    if (!account) {
      return NextResponse.json(
        { error: "No Google account found" },
        { status: 404 }
      );
    }

    // Update auto-include senders
    await db
      .update(googleAccounts)
      .set({
        autoIncludeSenders: senders,
        updatedAt: new Date(),
      })
      .where(eq(googleAccounts.id, account.id));

    return NextResponse.json({
      success: true,
      senders,
    });
  } catch (error) {
    console.error("Error updating auto-include senders:", error);
    return NextResponse.json(
      {
        error: "Failed to update auto-include senders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
