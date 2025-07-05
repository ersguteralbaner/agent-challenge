import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import { getOAuthClient } from "./gmail-tool";
import { PinoLogger } from "@mastra/loggers";

const logger = new PinoLogger({
  name: "PhishingCheckerTool",
  level: "debug"
});

function analyzePhishingIndicators(content: string, from: string): { score: number, issues: string[] } {
  const issues: string[] = [];
  let score = 0;

  const suspiciousWords = [
    "urgent", "immediately", "password", "verify your account",
    "confirm your identity", "click here", "account suspended"
  ];

  const suspiciousLinkPatterns = [
    /http[s]?:\/\/[^ ]*(\d{1,3}\.){3}\d{1,3}/i, // raw IP links
    /http[s]?:\/\/[^ ]+@[^ ]+/i, // user@domain links
    /%[0-9a-f]{2}/i // URL encoding
  ];

  const links = [...content.matchAll(/https?:\/\/[^\s"]+/g)].map(m => m[0]);

  for (const word of suspiciousWords) {
    if (content.toLowerCase().includes(word)) {
      issues.push(`Contains suspicious word/phrase: "${word}"`);
      score += 1;
    }
  }

  for (const regex of suspiciousLinkPatterns) {
    if (regex.test(content)) {
      issues.push("Contains suspicious link pattern");
      score += 2;
    }
  }

  if ((from.includes('<') && from.includes('>')) && !from.includes('@')) {
    issues.push("From header might be spoofed");
    score += 2;
  }

  if (links.length > 5) {
    issues.push(`Too many links (${links.length})`);
    score += 1;
  }

  if (score === 0) {
    issues.push("No obvious phishing indicators detected");
  }

  return { score, issues };
}

export const phishingTool = createTool({
  id: "phishing_checker",
  description: "Analyzes an email for phishing indicators by email ID",
  inputSchema: z.object({
    emailId: z.string().describe("Gmail email ID to check"),
  }),
  outputSchema: z.object({
    emailId: z.string(),
    from: z.string(),
    subject: z.string(),
    score: z.number(),
    riskLevel: z.enum(["low", "medium", "high"]),
    issues: z.array(z.string()),
  }),
  execute: async (input) => {
    const executionId = Math.random().toString(36).substring(2, 6);
    const { emailId } = input.context;

    logger.info({ executionId, emailId }, "Running phishing check");

    try {
      const gmail = google.gmail({ version: 'v1', auth: getOAuthClient() });

      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'full'
      });

      const payload = msg.data.payload;
      const headers = payload?.headers || [];

      const getHeader = (name: string) =>
        headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('From');
      const subject = getHeader('Subject');

      const content = (() => {
        if (payload?.body?.data) {
          return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }

        if (payload?.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
            if (part.mimeType === 'text/html' && part.body?.data) {
              return Buffer.from(part.body.data, 'base64').toString('utf-8').replace(/<[^>]*>/g, '');
            }
          }
        }

        return '';
      })();

      const { score, issues } = analyzePhishingIndicators(content, from);
      const riskLevel = score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low';

      return {
        emailId,
        from,
        subject,
        score,
        riskLevel,
        issues,
      };
    } catch (error) {
      logger.error({ executionId, emailId, error }, "Phishing check failed");
      throw new Error(`Phishing check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

