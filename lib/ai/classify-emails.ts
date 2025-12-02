// Email classification using Vercel AI SDK with OpenAI
// Classifies emails for deletion candidates

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { getBatchSenderPenalties } from "../learning";

// Input type for email classification
export interface EmailInput {
  gmailMessageId: string;
  sender: string;
  subject: string;
  snippet: string;
  labels: string[];
  hasUserReplied: boolean;
  senderFrequency: number; // Total count of emails from this sender
  googleAccountId: string; // For learning system integration
}

// Output type for classification results
export interface ClassificationResult {
  gmailMessageId: string;
  category:
    | "unknown"
    | "personal"
    | "work"
    | "receipt"
    | "promo"
    | "notification"
    | "spamLike";
  deleteScore: number; // 0-1, higher means more likely to delete
  reason: string; // Short explanation
}

// Schema for structured output
const classificationSchema = z.object({
  classifications: z.array(
    z.object({
      gmailMessageId: z.string(),
      category: z.enum([
        "unknown",
        "personal",
        "work",
        "receipt",
        "promo",
        "notification",
        "spamLike",
      ]),
      deleteScore: z.number().min(0).max(1),
      reason: z.string(),
    })
  ),
});

// Chunk size for batching emails - larger chunks = fewer API calls
// 50 emails per call is optimal for gpt-4o-mini
const CHUNK_SIZE = 50;

/**
 * Classify emails for deletion using OpenAI
 * Processes emails in chunks in parallel for faster results
 */
export async function classifyEmailsForDeletion(
  emails: EmailInput[]
): Promise<ClassificationResult[]> {
  // Split emails into chunks
  const chunks: EmailInput[][] = [];
  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    chunks.push(emails.slice(i, i + CHUNK_SIZE));
  }

  // Process all chunks in parallel (3x-5x faster!)
  const chunkPromises = chunks.map(async (chunk, index) => {
    try {
      return await classifyChunk(chunk);
    } catch (error) {
      console.error(`Error classifying chunk ${index}:`, error);
      // Return default results for failed chunk
      return chunk.map((email) => ({
        gmailMessageId: email.gmailMessageId,
        category: "unknown" as const,
        deleteScore: 0,
        reason: "Classification failed",
      }));
    }
  });

  // Wait for all chunks to complete
  const chunkResults = await Promise.all(chunkPromises);
  
  // Flatten results
  return chunkResults.flat();
}

/**
 * Classify a single chunk of emails
 */
async function classifyChunk(
  emails: EmailInput[]
): Promise<ClassificationResult[]> {
  // Get sender penalties for learning system integration (batch fetch - much faster!)
  const uniqueSenders = [...new Set(emails.map(e => e.sender))];
  const googleAccountId = emails[0]?.googleAccountId;
  
  const senderPenalties = await getBatchSenderPenalties(
    googleAccountId,
    uniqueSenders
  );

  // Build prompt with email data including learning context
  const emailData = emails.map((email) => {
    const penalty = senderPenalties.get(email.sender) || 1.0;
    const keepRatio =
      penalty < 1.0
        ? `User keeps ${Math.round(
            (1 - penalty) * 100
          )}% of emails from this sender`
        : null;

    return {
      id: email.gmailMessageId,
      sender: email.sender,
      subject: email.subject,
      snippet: email.snippet.substring(0, 200), // Limit snippet length
      labels: email.labels.join(", "),
      hasUserReplied: email.hasUserReplied,
      senderFrequency: email.senderFrequency,
      userBehavior: keepRatio || "No previous user actions",
    };
  });

  // Map invalid categories to valid ones
  function normalizeCategory(
    category: string
  ): ClassificationResult["category"] {
    const lower = category.toLowerCase();
    if (
      [
        "personal",
        "work",
        "receipt",
        "promo",
        "notification",
        "spamLike",
        "unknown",
      ].includes(lower)
    ) {
      return lower as ClassificationResult["category"];
    }
    // Map common invalid categories to valid ones
    if (
      lower.includes("important") ||
      lower.includes("urgent") ||
      lower.includes("critical")
    ) {
      return "work"; // Important emails are usually work-related
    }
    if (lower.includes("newsletter") || lower.includes("marketing")) {
      return "promo";
    }
    if (lower.includes("alert") || lower.includes("reminder")) {
      return "notification";
    }
    // Default to unknown if can't map
    return "unknown";
  }

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: classificationSchema,
      system: `You are an email triage AI that helps decide what emails are safe to delete.
      
Your task is to:
1. Categorize each email using ONLY these exact categories: "unknown", "personal", "work", "receipt", "promo", "notification", "spamLike"
   - "unknown": Cannot determine category
   - "personal": Personal emails from friends/family
   - "work": Work-related emails, important notifications, support tickets
   - "receipt": Receipts, invoices, financial documents
   - "promo": Promotional emails, newsletters, marketing
   - "notification": Alerts, reminders, system notifications
   - "spamLike": Spam or suspicious emails
2. Assign a deleteScore from 0-1 (0 = keep, 1 = definitely delete)
3. Provide a brief reason for your decision

CRITICAL: You MUST use only the exact category names listed above. Do not use "important" or any other category name.

Consider:
- Promotional emails, newsletters, and spam-like content should have high deleteScore
- Important receipts, personal conversations, and work emails should have low deleteScore
- If user has replied, it's likely important (lower deleteScore)
- High sender frequency might indicate newsletters/promos (higher deleteScore)
- Gmail labels like "CATEGORY_PROMOTIONS" or "CATEGORY_SOCIAL" suggest deletable content
- IMPORTANT: If "userBehavior" shows the user keeps most emails from a sender, significantly reduce deleteScore
- Learn from user behavior - if they consistently keep emails from a sender, respect that pattern

Be conservative - only suggest deletion for clearly safe-to-delete emails.`,
      prompt: `Classify these emails for deletion:

${JSON.stringify(emailData, null, 2)}

Return a JSON array with classifications for each email. Use ONLY these categories: "unknown", "personal", "work", "receipt", "promo", "notification", "spamLike"`,
    });

    // Apply learning system penalty to delete scores and normalize categories
    return object.classifications.map((c) => {
      const email = emails.find((e) => e.gmailMessageId === c.gmailMessageId);
      const penalty = email ? senderPenalties.get(email.sender) || 1.0 : 1.0;

      // Normalize category in case AI returns invalid one
      const normalizedCategory = normalizeCategory(c.category);

      // Apply penalty: if user keeps emails from this sender, reduce deleteScore
      const adjustedDeleteScore = c.deleteScore * penalty;

      return {
        gmailMessageId: c.gmailMessageId,
        category: normalizedCategory,
        deleteScore: Math.min(1.0, adjustedDeleteScore), // Cap at 1.0
        reason:
          penalty < 1.0
            ? `${c.reason} (Adjusted based on user's keep pattern for this sender)`
            : c.reason,
      };
    });
  } catch (error: any) {
    // If validation fails, try to parse and fix the response
    console.error("Error in generateObject, attempting recovery:", error);

    // Try to extract the text response if available
    if (error.text) {
      try {
        const parsed = JSON.parse(error.text);
        if (parsed.classifications && Array.isArray(parsed.classifications)) {
          return parsed.classifications.map((c: any) => {
            const email = emails.find(
              (e) => e.gmailMessageId === c.gmailMessageId
            );
            const penalty = email
              ? senderPenalties.get(email.sender) || 1.0
              : 1.0;
            const normalizedCategory = normalizeCategory(c.category);
            const adjustedDeleteScore = (c.deleteScore || 0) * penalty;

            return {
              gmailMessageId: c.gmailMessageId,
              category: normalizedCategory,
              deleteScore: Math.min(1.0, adjustedDeleteScore),
              reason: c.reason || "Classification completed",
            };
          });
        }
      } catch (parseError) {
        console.error("Failed to parse error response:", parseError);
      }
    }

    // If all else fails, throw the error
    throw error;
  }
}
