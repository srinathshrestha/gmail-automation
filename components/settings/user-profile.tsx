"use client";

// User profile settings component
// Handles username change, password change, and gradient avatar picker
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";
import { showToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UserProfileProps {
  user: {
    id: string;
    username: string;
    email: string | null;
    gradient?: string; // User's selected gradient
  };
  onUpdate?: () => void;
}

// Predefined gradient options
const GRADIENT_OPTIONS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  "linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  "linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)",
  "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
  "linear-gradient(135deg, #f77062 0%, #fe5196 100%)",
];

export function UserProfile({ user, onUpdate }: UserProfileProps) {
  // Username change state
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Gradient picker state
  const [showGradientPicker, setShowGradientPicker] = useState(false);
  const [selectedGradient, setSelectedGradient] = useState(
    user.gradient || GRADIENT_OPTIONS[0]
  );

  // Get user initials for avatar
  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  // Handle username change
  async function handleUsernameChange() {
    if (!newUsername.trim()) {
      showToast("Username cannot be empty", "error");
      return;
    }

    if (newUsername.trim().length < 3) {
      showToast("Username must be at least 3 characters", "error");
      return;
    }

    try {
      setUsernameLoading(true);
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update username");
      }

      showToast("Username updated successfully", "success");
      setShowUsernameDialog(false);
      setNewUsername("");
      
      // Trigger session refresh
      window.dispatchEvent(new Event("session-updated"));
      
      if (onUpdate) onUpdate();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to update username",
        "error"
      );
    } finally {
      setUsernameLoading(false);
    }
  }

  // Handle password change
  async function handlePasswordChange() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Please fill in all password fields", "error");
      return;
    }

    if (newPassword.length < 8) {
      showToast("New password must be at least 8 characters", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }

    try {
      setPasswordLoading(true);
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      showToast("Password updated successfully", "success");
      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to update password",
        "error"
      );
    } finally {
      setPasswordLoading(false);
    }
  }

  // Handle gradient selection
  async function handleGradientChange(gradient: string) {
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradient }),
      });

      if (!response.ok) {
        throw new Error("Failed to update gradient");
      }

      setSelectedGradient(gradient);
      showToast("Avatar gradient updated", "success");
      
      // Trigger session refresh
      window.dispatchEvent(new Event("session-updated"));
      
      if (onUpdate) onUpdate();
    } catch (error) {
      showToast("Failed to update gradient", "error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
        <CardDescription>Manage your account details and preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold cursor-pointer hover:opacity-90 transition-opacity"
            style={{ background: selectedGradient }}
            onClick={() => setShowGradientPicker(true)}
          >
            {getInitials(user.username)}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold">{user.username}</h4>
            {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setShowGradientPicker(true)}
            >
              <Icon name="Palette" className="mr-2" size={14} />
              Change Avatar Color
            </Button>
          </div>
        </div>

        {/* Account Settings */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Username</Label>
              <p className="text-sm text-muted-foreground">{user.username}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewUsername(user.username);
                setShowUsernameDialog(true);
              }}
            >
              <Icon name="Edit" className="mr-2" size={14} />
              Change
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Password</Label>
              <p className="text-sm text-muted-foreground">••••••••</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPasswordDialog(true)}
            >
              <Icon name="Lock" className="mr-2" size={14} />
              Change
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Username Change Dialog */}
      <Dialog open={showUsernameDialog} onOpenChange={setShowUsernameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Username</DialogTitle>
            <DialogDescription>
              Enter your new username. It must be at least 3 characters long.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">New Username</Label>
              <Input
                id="new-username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username"
                minLength={3}
                maxLength={50}
                pattern="[a-zA-Z0-9_]+"
                disabled={usernameLoading}
              />
              <p className="text-xs text-muted-foreground">
                Letters, numbers, and underscores only
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUsernameDialog(false)}
              disabled={usernameLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleUsernameChange} disabled={usernameLoading}>
              {usernameLoading ? "Updating..." : "Update Username"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  disabled={passwordLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={passwordLoading}
                >
                  <Icon
                    name={showCurrentPassword ? "EyeOff" : "Eye"}
                    size={18}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  disabled={passwordLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={passwordLoading}
                >
                  <Icon
                    name={showNewPassword ? "EyeOff" : "Eye"}
                    size={18}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  minLength={8}
                  disabled={passwordLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={passwordLoading}
                >
                  <Icon
                    name={showConfirmPassword ? "EyeOff" : "Eye"}
                    size={18}
                  />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(false)}
              disabled={passwordLoading}
            >
              Cancel
            </Button>
            <Button onClick={handlePasswordChange} disabled={passwordLoading}>
              {passwordLoading ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gradient Picker Dialog */}
      <Dialog open={showGradientPicker} onOpenChange={setShowGradientPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Avatar Color</DialogTitle>
            <DialogDescription>
              Select a gradient for your profile avatar
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-3 py-4">
            {GRADIENT_OPTIONS.map((gradient, index) => (
              <button
                key={index}
                className={`w-full aspect-square rounded-lg hover:scale-105 transition-transform ${
                  selectedGradient === gradient
                    ? "ring-2 ring-primary ring-offset-2"
                    : ""
                }`}
                style={{ background: gradient }}
                onClick={() => {
                  handleGradientChange(gradient);
                  setShowGradientPicker(false);
                }}
              >
                {selectedGradient === gradient && (
                  <Icon name="Check" className="text-white mx-auto" size={24} />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

