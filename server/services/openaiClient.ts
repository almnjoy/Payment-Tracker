import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function isLlmEnabled() {
  return (
    Boolean(process.env.OPENAI_API_KEY) &&
    process.env.AI_ANALYZER_ENABLE_LLM !== "false"
  );
}
