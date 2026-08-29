import { ModelConfig, ChatMessage, PromptMode } from '../types';

export function generateCurlCode(
  mode: PromptMode,
  config: ModelConfig,
  chatMessages?: ChatMessage[],
  freeformText?: string
): string {
  let promptContent = '';
  if (mode === 'chat' && chatMessages && chatMessages.length > 0) {
    const formatted = chatMessages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));
    promptContent = JSON.stringify(formatted, null, 2);
  } else {
    promptContent = JSON.stringify({
      contents: [{ parts: [{ text: freeformText || 'Hello Gemini!' }] }],
    }, null, 2);
  }

  return `curl "https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=\${GEMINI_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": ${mode === 'chat' ? promptContent : `[{"parts":[{"text": "${(freeformText || 'Hello Gemini!').replace(/"/g, '\\"')}"}]}]`},
    "generationConfig": {
      "temperature": ${config.temperature},
      "topP": ${config.topP},
      "topK": ${config.topK},
      "maxOutputTokens": ${config.maxOutputTokens}${config.responseMimeType !== 'text/plain' ? `,\n      "responseMimeType": "${config.responseMimeType}"` : ''}
    }${config.systemInstruction ? `,\n    "systemInstruction": {\n      "parts": [{"text": "${config.systemInstruction.replace(/"/g, '\\"')}"}]\n    }` : ''}${config.enableGoogleSearch ? `,\n    "tools": [{"googleSearch": {}}]` : ''}
  }'`;
}

export function generatePythonCode(
  mode: PromptMode,
  config: ModelConfig,
  chatMessages?: ChatMessage[],
  freeformText?: string
): string {
  const isChat = mode === 'chat' && chatMessages && chatMessages.length > 0;
  const promptStr = isChat
    ? chatMessages.map(m => `    {"role": "${m.role}", "parts": [{"text": """${m.text.replace(/"""/g, '\\"\\"\\"')}"""}]}`).join(',\n')
    : `"""${(freeformText || 'Hello Gemini!').replace(/"""/g, '\\"\\"\\"')}"""`;

  return `# Install SDK: pip install google-genai
import os
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

config = types.GenerateContentConfig(
    temperature=${config.temperature},
    top_p=${config.topP},
    top_k=${config.topK},
    max_output_tokens=${config.maxOutputTokens},${config.systemInstruction ? `\n    system_instruction="""${config.systemInstruction.replace(/"""/g, '\\"\\"\\"')}\""",` : ''}${config.responseMimeType !== 'text/plain' ? `\n    response_mime_type="${config.responseMimeType}",` : ''}${config.enableGoogleSearch ? `\n    tools=[types.Tool(google_search=types.GoogleSearch())],` : ''}
)

${isChat ? `contents = [\n${promptStr}\n]\n\nresponse = client.models.generate_content(\n    model="${config.model}",\n    contents=contents,\n    config=config,\n)` : `response = client.models.generate_content(\n    model="${config.model}",\n    contents=${promptStr},\n    config=config,\n)`}

print(response.text)
`;
}

export function generateTypeScriptCode(
  mode: PromptMode,
  config: ModelConfig,
  chatMessages?: ChatMessage[],
  freeformText?: string
): string {
  const isChat = mode === 'chat' && chatMessages && chatMessages.length > 0;
  
  return `// Install SDK: npm install @google/genai
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function main() {
  const response = await ai.models.generateContent({
    model: "${config.model}",
    contents: ${isChat ? JSON.stringify(chatMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] })), null, 6) : JSON.stringify(freeformText || "Hello Gemini!")},
    config: {
      temperature: ${config.temperature},
      topP: ${config.topP},
      topK: ${config.topK},
      maxOutputTokens: ${config.maxOutputTokens},${config.systemInstruction ? `\n      systemInstruction: ${JSON.stringify(config.systemInstruction)},` : ''}${config.responseMimeType !== 'text/plain' ? `\n      responseMimeType: "${config.responseMimeType}",` : ''}${config.enableGoogleSearch ? `\n      tools: [{ googleSearch: {} }],` : ''}
    },
  });

  console.log(response.text);
}

main().catch(console.error);
`;
}
