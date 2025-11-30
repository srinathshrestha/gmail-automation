// NextAuth configuration with Google provider
// Requests Gmail scopes for API access

import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import {
  createOrUpdateUser,
  createOrUpdateGoogleAccount,
} from "@/lib/auth-helpers";

// Gmail API scopes
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: ["openid", "email", "profile", ...GMAIL_SCOPES].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Verify we have the required account data
      if (!account || !user.email || !account.providerAccountId) {
        return false;
      }

      // Verify Gmail scopes are present
      const hasGmailScopes = GMAIL_SCOPES.every((scope) =>
        account.scope?.includes(scope)
      );
      if (!hasGmailScopes) {
        console.error("Missing required Gmail scopes");
        return false;
      }

      try {
        // Create or update user
        const dbUser = await createOrUpdateUser(
          account.providerAccountId,
          user.email
        );

        // Store GoogleAccount with tokens
        if (account.refresh_token && account.access_token) {
          const expiresAt = account.expires_at
            ? new Date(account.expires_at * 1000)
            : null;

          await createOrUpdateGoogleAccount(
            dbUser.id,
            user.email,
            account.refresh_token,
            account.access_token,
            expiresAt,
            account.scope?.split(" ") || []
          );
        }

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    async jwt({ token, account, user }) {
      // Initial sign in - store user ID in token
      if (account && user) {
        // Get user from database to get the ID
        const { createOrUpdateUser } = await import("@/lib/auth-helpers");
        const dbUser = await createOrUpdateUser(
          account.providerAccountId,
          user.email!
        );
        token.userId = dbUser.id;
        token.email = dbUser.email;
      }
      return token;
    },
    async session({ session, token }) {
      // Attach user ID to session
      if (session.user && token.userId) {
        session.user.id = token.userId;
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
