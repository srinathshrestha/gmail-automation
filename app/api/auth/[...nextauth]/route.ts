// NextAuth route - DEPRECATED
// This route is kept for backward compatibility but is no longer used for user authentication.
// User authentication is now handled via username/password in /api/auth/login and /api/auth/register.
// Google OAuth for connecting Gmail accounts is handled via /api/auth/connect-google.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Please use /api/auth/login for authentication.",
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Please use /api/auth/login for authentication.",
    },
    { status: 410 }
  );
}
