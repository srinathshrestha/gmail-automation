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
  };
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const router = useRouter();

  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch("/api/auth/session");
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
    }

    fetchSession();
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

