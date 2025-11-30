// User profile update route
// Handles username, password, and gradient updates

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth-helpers";
import { z } from "zod";

// Schema for profile updates
const profileUpdateSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
  gradient: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updates = profileUpdateSchema.parse(body);

    // Get current user data
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUser = userResult[0];

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Handle username change
    if (updates.username && updates.username !== currentUser.username) {
      // Check if username is already taken
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.username, updates.username))
        .limit(1);

      if (existingUser.length > 0) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 400 }
        );
      }

      updateData.username = updates.username;
    }

    // Handle password change
    if (updates.currentPassword && updates.newPassword) {
      // Verify current password
      const isValid = await verifyPassword(
        updates.currentPassword,
        currentUser.passwordHash
      );

      if (!isValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      // Hash new password
      updateData.passwordHash = await hashPassword(updates.newPassword);
    } else if (updates.currentPassword || updates.newPassword) {
      return NextResponse.json(
        { error: "Both current and new password are required" },
        { status: 400 }
      );
    }

    // Handle gradient change
    if (updates.gradient !== undefined) {
      updateData.gradient = updates.gradient;
    }

    // Update user
    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.userId))
      .returning();

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        gradient: updated.gradient,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to update profile",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

