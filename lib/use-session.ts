// Client-side session hook
// Replaces useSession from next-auth

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface Session {
  user: {
    id: string;
    username: string;
    email: string | null;
    gradient?: string | null;
  };
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const router = useRouter();

  // Fetch session function
  const fetchSession = async () => {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store", // Always fetch fresh session
      });
      const data = await response.json();

      if (data.user) {
        setSession({ user: data.user });
        setStatus("authenticated");
      } else {
        setSession(null);
        setStatus("unauthenticated");
      }
    } catch (error) {
      console.error("Error fetching session:", error);
      setSession(null);
      setStatus("unauthenticated");
    }
  };

  // Fetch session on mount
  useEffect(() => {
    fetchSession();
  }, []);

  // Listen for custom session update events
  useEffect(() => {
    const handleSessionUpdate = () => {
      fetchSession();
    };

    window.addEventListener("session-updated", handleSessionUpdate);
    return () => {
      window.removeEventListener("session-updated", handleSessionUpdate);
    };
  }, []);

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setSession(null);
      setStatus("unauthenticated");
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return {
    data: session,
    status,
    signOut,
  };
}

