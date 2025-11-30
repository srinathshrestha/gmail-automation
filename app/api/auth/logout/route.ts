// User logout route
// Clears the session cookie

import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to logout", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

