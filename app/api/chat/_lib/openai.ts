// /app/api/chat/_lib/openai.ts
import OpenAI from "openai";

export function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export function getModelName() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}
