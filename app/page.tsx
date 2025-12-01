// Landing page with hero section
"use client";

import { useSession } from "@/lib/use-session";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/logo";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect authenticated users to dashboard
    if (status === "authenticated" && session) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  // Show loading while checking auth status
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo size={80} className="h-16 w-16 sm:h-20 sm:w-20" />
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
              Tired of deleting emails manually?
            </h1>
            <p className="text-xl sm:text-2xl md:text-3xl text-muted-foreground font-medium">
              Say no more.
            </p>
          </div>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Sign in and{" "}
            <span className="font-semibold text-foreground">InboxJanitor</span>{" "}
            will take care of the rest.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button
              size="lg"
              onClick={() => router.push("/login")}
              className="w-full sm:w-auto text-lg px-8 py-6"
            >
              <Icon name="Mail" className="mr-2" size={20} />
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push("/register")}
              className="w-full sm:w-auto text-lg px-8 py-6"
            >
              Create Account
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 max-w-3xl mx-auto">
            <div className="space-y-2">
              <div className="flex justify-center">
                <Icon name="Bot" className="h-8 w-8 text-primary" size={32} />
              </div>
              <h3 className="font-semibold">AI-Powered</h3>
              <p className="text-sm text-muted-foreground">
                Smart suggestions for emails you can safely delete
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-center">
                <Icon
                  name="Shield"
                  className="h-8 w-8 text-primary"
                  size={32}
                />
              </div>
              <h3 className="font-semibold">Safe & Secure</h3>
              <p className="text-sm text-muted-foreground">
                Your data stays encrypted and private
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-center">
                <Icon
                  name="Refresh"
                  className="h-8 w-8 text-primary"
                  size={32}
                />
              </div>
              <h3 className="font-semibold">Automatic</h3>
              <p className="text-sm text-muted-foreground">
                Set it once and let it work for you
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 border-t">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>&copy; 2024 InboxJanitor. All rights reserved.</p>
          <a
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  );
}
