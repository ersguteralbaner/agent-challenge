import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import { getOAuthClient } from "./gmail-tool";
import { PinoLogger } from "@mastra/loggers";
import { emailAssistantAgent } from "./email-assistant-agent";

const logger = new PinoLogger({
  name: "DraftTool",
  level: "debug"
});

function extractEmailContent(payload: any): string {
  logger.debug("Extracting email content from payload");
  if (!payload) {
    logger.warn("No payload available for content extraction");
    return 'No content available';
  }

  if (payload.parts) {
    logger.debug(`Processing multipart email with ${payload.parts.length} parts`);
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        logger.debug("Found plain text part");
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        logger.debug("Found HTML part, converting to text");
        const htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
        return htmlContent.replace(/<[^>]*>/g, '');
      }
      if (part.parts) {
        logger.debug("Found nested parts, recursing");
        const nestedContent = extractEmailContent(part);
        if (nestedContent) return nestedContent;
      }
    }
  }

  if (payload.body?.data) {
    logger.debug("Found simple email body");
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  logger.debug("Falling back to snippet");
  return payload.snippet || 'No content available';
}


export const draftTool = createTool({
  id: "Draft email response",
  description: "Fetches complete email content by ID and drafts a professional response",
  inputSchema: z.object({
    emailId: z.string().describe("Email ID.")
  }),
  outputSchema: z.object({
    metadata: z.object({
      id: z.string(),
      subject: z.string(),
      from: z.string(),
      date: z.string(),
      to: z.string().optional(),
      cc: z.string().optional(),
    }),
    prompt: z.string(),
  }),
  execute: async (params) => {
    const executionId = Math.random().toString(36).substring(2, 6);
    logger.debug({ executionId, params }, "RAW PARAMETERS RECEIVED");

    // Extract emailId with broader compatibility
    let rawEmailId: string | undefined;

    if (typeof params === 'object' && params !== null) {
      if (
        'context' in params &&
        typeof params.context === 'object' &&
        params.context !== null &&
        'emailId' in params.context &&
        typeof params.context.emailId === 'string'
      ) {
        rawEmailId = params.context.emailId;
        logger.debug({ executionId, source: 'params.context.emailId', rawEmailId }, "Extracted emailId from params.context.emailId");
      } else {
        logger.warn({ executionId, params }, "No emailId found in params.context.emailId");
      }
    }
     else {
      logger.warn({ executionId, params }, "Invalid params type or null");
    }

    const trimmedEmailId = rawEmailId?.trim();
    const isValidEmailId = !!trimmedEmailId && trimmedEmailId.length > 0;

    logger.debug({
      executionId,
      rawEmailId,
      trimmedEmailId,
      isValidEmailId,
      params
    }, "EMAIL ID RESOLUTION DEBUG");

    try {
      const gmail = google.gmail({ version: 'v1', auth: getOAuthClient() });

      if (isValidEmailId) {
        logger.info({ executionId, emailId: trimmedEmailId }, "Fetching SPECIFIC email by ID");

        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: trimmedEmailId,
            format: 'full'
          });

          logger.debug({ executionId, emailId: trimmedEmailId, messageId: msg.data.id }, "Successfully fetched email");

          const headers = msg.data.payload?.headers || [];
          const getHeader = (name: string) => {
            const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
            logger.debug({ executionId, headerName: name, headerValue: header }, "Header lookup");
            return header;
          };

          return {
            metadata: {
              id: msg.data.id || trimmedEmailId,
              subject: getHeader('Subject') || 'No Subject',
              from: getHeader('From') || 'Unknown',
              date: getHeader('Date') || new Date().toISOString(),
              to: getHeader('To'),
              cc: getHeader('Cc'),
            },
            prompt:`Draft a professional email response to this:\n\n${extractEmailContent(msg.data.payload)}`,
          };
        } catch (error) {
          logger.error({
            executionId,
            emailId: trimmedEmailId,
            error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error)
          }, "Failed to fetch specific email");
          throw new Error(`Invalid or inaccessible email ID: ${trimmedEmailId}`);
        }
      } else {
        logger.info({ executionId }, "Fetching LATEST email (no valid ID provided)");

        const listRes = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 1,
        });

        if (!listRes.data.messages || listRes.data.messages.length === 0) {
          logger.error({ executionId }, "No emails found in inbox");
          throw new Error("No emails found in inbox");
        }

        const latestEmailId = listRes.data.messages[0].id!;
        logger.debug({ executionId, latestEmailId }, "Found latest email ID");

        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: latestEmailId,
          format: 'full'
        });

        logger.debug({ executionId, latestEmailId, messageId: msg.data.id }, "Successfully fetched email");

        const headers = msg.data.payload?.headers || [];
        const getHeader = (name: string) => {
          const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
          logger.debug({ executionId, headerName: name, headerValue: header }, "Header lookup");
          return header;
        };
        
        return {
          metadata: {
            id: msg.data.id || latestEmailId,
            subject: getHeader('Subject') || 'No Subject',
            from: getHeader('From') || 'Unknown',
            date: getHeader('Date') || new Date().toISOString(),
            to: getHeader('To'),
            cc: getHeader('Cc'),
          },
          prompt:`Draft a professional email response to this:\n\n${extractEmailContent(msg.data.payload)}`,
        };
      }
    } catch (error) {
      logger.error({
        executionId,
        inputSnapshot: {
          originalParams: params,
          emailIdReceived: rawEmailId,
          trimmedEmailId,
          isValidEmailId
        },
        error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error)
      }, "DraftTool execution failed");
      throw new Error(`Failed to fetch email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});
