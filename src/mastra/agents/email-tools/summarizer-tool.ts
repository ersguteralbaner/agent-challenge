// tools/summarizer-tool.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import { getOAuthClient } from "./gmail-tool";
import { PinoLogger } from "@mastra/loggers";
import { emailAssistantAgent } from "./email-assistant-agent";

const logger = new PinoLogger({
  name: "SummarizerTool",
  level: "debug",
});

function extractPlainText(payload: any): string {
  if (!payload) return '';

  // If body data exists, decode and return
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    if (payload.mimeType === 'text/html') {
      return decoded.replace(/<[^>]*>/g, '').trim();
    }
    return decoded.trim();
  }

  // If multipart, recursively check parts
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text; // Return first non-empty text found
    }
  }

  return '';
}

export const summarizerTool = createTool({
  id: "summarizer_tool",
  description: "Summarizes the full content of an email in 3 bullet points",
  inputSchema: z.object({
    emailId: z.string().describe("Gmail email ID to summarize"),
  }),
  outputSchema: z.object({
    emailId: z.string(),
    subject: z.string(),
    summary: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const { emailId } = context;
    logger.info({ emailId }, "Summarizing email");

    try {
      const gmail = google.gmail({ version: 'v1', auth: getOAuthClient() });
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'full',
      });

      const payload = msg.data.payload;
      const headers = payload?.headers || [];

      const getHeader = (name: string) =>
        headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject');
      const content = extractPlainText(payload);

      logger.debug({ emailId, contentLength: content.length, contentSnippet: content.slice(0, 100) }, "Extracted email content");

      if (!content.trim()) {
        logger.warn({ emailId }, "Email content empty, cannot summarize");
        return {
          emailId,
          subject,
          summary: ["No content available to summarize."],
        };
      }

      const prompt = `Summarize the following email in 3 concise bullet points:\n\n${content}`;

      return {
        emailId,
        subject,
        prompt,
      };

    } catch (error) {
      logger.error({ emailId, error }, "Summarizer failed");
      throw new Error(`Failed to summarize email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});
