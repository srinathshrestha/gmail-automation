import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Nav } from "@/components/nav";
import { ToastContainer } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "InboxJanitor - Gmail Automation",
  description: "AI-powered Gmail inbox management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <Nav />
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
              {children}
            </main>
            <ToastContainer />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
