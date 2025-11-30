"use client";

// Navigation component
import Link from "next/link";
import { useSession } from "@/lib/use-session";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/logo";
import { useState } from "react";

export function Nav() {
  const { data: session, status, signOut } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (status === "loading") {
    return null;
  }

  if (!session) {
    return (
      <nav className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo size={32} iconOnly className="h-6 w-6 sm:h-7 sm:w-7" />
            <span className="hidden sm:inline text-lg">InboxJanitor</span>
            <span className="sm:hidden">IJ</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button size="sm" className="hidden sm:inline-flex">Sign In</Button>
              <Button size="icon" className="sm:hidden">
                <Icon name="LogOut" size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "Dashboard" as const },
    { href: "/messages", label: "Messages", icon: "Message" as const },
    { href: "/agent", label: "Agent", icon: "Bot" as const },
    { href: "/settings", label: "Settings", icon: "Settings" as const },
  ];

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Logo size={32} iconOnly className="h-6 w-6 sm:h-7 sm:w-7" />
            <span className="hidden sm:inline text-lg">InboxJanitor</span>
            <span className="sm:hidden">IJ</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <Icon name={item.icon} className="h-4 w-4" size={16} />
                  {item.label}
                </Link>
              );
            })}

            <div className="flex items-center gap-4 ml-4">
              <div className="hidden lg:flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{
                    background:
                      session.user?.gradient ||
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  }}
                >
                  {session.user?.username?.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-sm text-muted-foreground">
                  {session.user?.username}
                </span>
              </div>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={async () => await signOut()}>
                <Icon name="LogOut" className="mr-2" size={16} />
                <span className="hidden lg:inline">Sign Out</span>
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <Icon name={mobileMenuOpen ? "X" : "Menu"} size={20} />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t pt-4">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Icon name={item.icon} className="h-4 w-4" size={16} />
                    {item.label}
                  </Link>
                );
              })}
              <div className="pt-2 border-t mt-2">
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {session.user?.username}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={async () => {
                    await signOut();
                    setMobileMenuOpen(false);
                  }}
                >
                  <Icon name="LogOut" className="mr-2" size={16} />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
