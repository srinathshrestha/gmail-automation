// Email classification using Vercel AI SDK with OpenAI
// Classifies emails for deletion candidates

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { getSenderPenalty } from "../learning";

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

// Chunk size for batching emails (20-40 per request)
const CHUNK_SIZE = 30;

/**
 * Classify emails for deletion using OpenAI
 * Processes emails in chunks to stay within token limits
 */
export async function classifyEmailsForDeletion(
  emails: EmailInput[]
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = [];

  // Process emails in chunks
  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE);

    try {
      const chunkResults = await classifyChunk(chunk);
      results.push(...chunkResults);
    } catch (error) {
      console.error(`Error classifying chunk ${i}-${i + chunk.length}:`, error);
      // Add default results for failed chunk
      chunk.forEach((email) => {
        results.push({
          gmailMessageId: email.gmailMessageId,
          category: "unknown",
          deleteScore: 0,
          reason: "Classification failed",
        });
      });
    }
  }

  return results;
}

/**
 * Classify a single chunk of emails
 */
async function classifyChunk(
  emails: EmailInput[]
): Promise<ClassificationResult[]> {
  // Get sender penalties for learning system integration
  const senderPenalties = new Map<string, number>();
  for (const email of emails) {
    if (!senderPenalties.has(email.sender)) {
      const penalty = await getSenderPenalty(
        email.googleAccountId,
        email.sender
      );
      senderPenalties.set(email.sender, penalty);
    }
  }

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
