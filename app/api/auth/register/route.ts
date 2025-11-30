// User registration route
// Creates a new user with username and password

import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/auth-helpers";
import { setSession } from "@/lib/session";
import { z } from "zod";

const registerSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, email } = registerSchema.parse(body);

    // Create user
    const user = await createUser(username, password, email);

    // Create session
    await setSession({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "Username already exists") {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create account", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

