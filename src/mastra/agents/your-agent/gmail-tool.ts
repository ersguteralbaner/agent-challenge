// agents/email-tools/gmail-tool.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import { PinoLogger } from "@mastra/loggers";
import { emailAssistantAgent } from "./email-assistant-agent";

const logger = new PinoLogger({
  name: "GmailTool",
  level: "debug"
});

export function getOAuthClient() {
  logger.debug("Initializing OAuth2 client");
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    logger.error("Missing GOOGLE_REFRESH_TOKEN in environment");
    throw new Error("Missing refresh token");
  }
  
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  logger.debug("OAuth2 client initialized");
  return oauth2Client;
}

async function fetchEmailList(limit: number) {
  const requestId = Math.random().toString(36).substring(2, 6);
  logger.info({ requestId, limit }, "Starting email list fetch");
  
  try {
    const gmail = google.gmail({ version: 'v1', auth: getOAuthClient() });
    
    logger.debug({ requestId }, "Requesting messages list from Gmail API");
    const listStart = Date.now();
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: limit,
    });
    logger.debug({ requestId, duration: Date.now() - listStart }, "Message list received");

    if (!res.data.messages || res.data.messages.length === 0) {
      logger.warn({ requestId }, "No messages found in inbox");
      return [];
    }

    logger.debug({ requestId, count: res.data.messages.length }, "Fetching message details");
    const messages = await Promise.all(
      res.data.messages.map(async (message) => {
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });
          
          const headers = msg.data.payload?.headers || [];
          return {
            id: message.id!,
            subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
            from: headers.find(h => h.name === 'From')?.value || 'Unknown',
            snippet: msg.data.snippet || 'No content',
            date: headers.find(h => h.name === 'Date')?.value || new Date().toISOString(),
          };
        } catch (error) {
          logger.error({ requestId, messageId: message.id, error }, "Error fetching message");
          return null;
        }
      })
    );

    const validMessages = messages.filter(Boolean);
    logger.info({ requestId, count: validMessages.length }, "Email list fetch completed");
    return validMessages;
  } catch (error) {
    logger.error({ requestId, error }, "Failed to fetch email list");
    throw error;
  }
}

export const gmailTool = createTool({
  id: "gmail_list",
  description: "Fetches list of emails from Gmail",
  inputSchema: z.object({
    limit: z.number().min(1).max(20).default(5),
  }),
  outputSchema: z.object({
    emails: z.array(z.object({
      id: z.string(),
      subject: z.string(),
      from: z.string(),
      snippet: z.string(),
      date: z.string(),
    })),
  }),
  execute: async (input) => {
    const executionId = Math.random().toString(36).substring(2, 6);
    logger.info({ executionId, input }, "GmailTool execution started");
    
    try {
      
      const emails = await fetchEmailList(input.context.limit || 5);
      logger.debug({ executionId, emailCount: emails.length }, "GmailTool execution completed");
      return { emails };
    } catch (error) {
      logger.error({ executionId, error }, "GmailTool execution failed");
      throw new Error(`Failed to fetch emails: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});
