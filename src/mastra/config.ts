// config.ts
import dotenv from "dotenv";
import { createOllama } from "ollama-ai-provider";
import { PinoLogger } from "@mastra/loggers";
const logger = new PinoLogger({ name: "EmailTools" });

dotenv.config();

export const modelName = process.env.MODEL_NAME_AT_ENDPOINT ?? "qwen2.5:1.5b";
export const baseURL = process.env.API_BASE_URL ?? "http://127.0.0.1:11434/api";

logger.debug("Initializing Ollama connection");
logger.debug(`Model: ${modelName}`);
logger.debug(`Base URL: ${baseURL}`);

const ollama = createOllama({ 
  baseURL,
  defaultHeaders: {
    'Content-Type': 'application/json'
  }
});

export const model = ollama.chat(modelName, {
  simulateStreaming: true,
  format: "json",
  temperature: 0.5  // Reduced for more consistent responses
});

logger.info("Ollama model configuration completed");
