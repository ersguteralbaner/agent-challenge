// index.ts
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { emailAssistantAgent } from "./agents/email-tools/email-assistant-agent";

const logger = new PinoLogger({
  name: "Mastra",
  level: "debug", // Set to debug for detailed logging during development
  serializers: {
    error: (err) => ({
      message: err.message,
      stack: err.stack,
      ...err
    })
  }
});

export const mastra = new Mastra({
  agents: { emailAssistantAgent },
  logger,
  server: {
    port: 8080,
    timeout: 100000,
  },
});

logger.info("Mastra application initialized");
