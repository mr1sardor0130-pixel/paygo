import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy Google GenAI Client
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Available Gemini Models list
app.get("/api/models", (_req, res) => {
  res.json({
    models: [
      {
        id: "gemini-3.7-flash",
        name: "Gemini 3.7 Flash",
        badge: "Recommended",
        description: "Next-gen multimodal workhorse for speed, reasoning, coding, and general tasks.",
        contextWindow: "1,048,576 tokens",
        maxOutputTokens: 8192,
        supportsImages: true,
        supportsAudio: true,
        supportsSearch: true,
        supportsJson: true,
        supportsThinking: true,
      },
      {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro (Preview)",
        badge: "Advanced",
        description: "Google's most capable model for complex multi-step reasoning, coding, and STEM.",
        contextWindow: "2,097,152 tokens",
        maxOutputTokens: 8192,
        supportsImages: true,
        supportsAudio: true,
        supportsSearch: true,
        supportsJson: true,
        supportsThinking: true,
      },
      {
        id: "gemini-3.1-flash-lite",
        name: "Gemini 3.1 Flash Lite",
        badge: "Fast & Lightweight",
        description: "Optimized for cost efficiency, high-volume throughput, and low latency tasks.",
        contextWindow: "1,048,576 tokens",
        maxOutputTokens: 8192,
        supportsImages: true,
        supportsAudio: false,
        supportsSearch: true,
        supportsJson: true,
        supportsThinking: false,
      },
    ],
  });
});

// Streaming generation endpoint (SSE)
app.post("/api/generate-stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const {
      model = "gemini-3.7-flash",
      contents,
      systemInstruction,
      temperature,
      topP,
      topK,
      maxOutputTokens,
      responseMimeType,
      responseSchema,
      enableGoogleSearch,
      thinkingLevel,
      safetySettings,
    } = req.body;

    const ai = getAiClient();

    // Prepare config
    const config: Record<string, any> = {};

    if (systemInstruction && systemInstruction.trim().length > 0) {
      config.systemInstruction = systemInstruction.trim();
    }
    if (typeof temperature === "number") {
      config.temperature = temperature;
    }
    if (typeof topP === "number") {
      config.topP = topP;
    }
    if (typeof topK === "number") {
      config.topK = topK;
    }
    if (typeof maxOutputTokens === "number" && maxOutputTokens > 0) {
      config.maxOutputTokens = maxOutputTokens;
    }
    if (responseMimeType) {
      config.responseMimeType = responseMimeType;
    }
    if (responseSchema && typeof responseSchema === "object") {
      config.responseSchema = responseSchema;
    }
    if (enableGoogleSearch) {
      config.tools = [{ googleSearch: {} }];
    }
    if (thinkingLevel && model.includes("3.")) {
      config.thinkingConfig = { thinkingLevel };
    }
    if (safetySettings && Array.isArray(safetySettings)) {
      config.safetySettings = safetySettings;
    }

    // Format contents into @google/genai format
    // Contents can be string or array of turn objects
    let formattedContents: any = contents;
    if (typeof contents === "string") {
      formattedContents = contents;
    } else if (Array.isArray(contents)) {
      formattedContents = contents.map((turn: any) => {
        if (typeof turn === "string") return turn;
        const parts: any[] = [];
        if (turn.text) {
          parts.push({ text: turn.text });
        }
        if (turn.files && Array.isArray(turn.files)) {
          for (const file of turn.files) {
            if (file.data && file.mimeType) {
              parts.push({
                inlineData: {
                  mimeType: file.mimeType,
                  data: file.data.replace(/^data:[^;]+;base64,/, ""),
                },
              });
            }
          }
        }
        return {
          role: turn.role || "user",
          parts: parts.length > 0 ? parts : [{ text: "" }],
        };
      });
    }

    const responseStream = await ai.models.generateContentStream({
      model,
      contents: formattedContents,
      config,
    });

    for await (const chunk of responseStream) {
      const text = chunk.text || "";
      const searchGrounding = chunk.candidates?.[0]?.groundingMetadata || null;
      const usageMetadata = chunk.usageMetadata || null;

      res.write(
        `data: ${JSON.stringify({
          type: "chunk",
          text,
          searchGrounding,
          usageMetadata,
        })}\n\n`
      );
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("Error during streaming generation:", error);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: error.message || "Failed to generate response from Gemini model.",
      })}\n\n`
    );
    res.end();
  }
});

// Single generation endpoint
app.post("/api/generate", async (req, res) => {
  try {
    const {
      model = "gemini-3.7-flash",
      contents,
      systemInstruction,
      temperature,
      topP,
      topK,
      maxOutputTokens,
      responseMimeType,
      responseSchema,
      enableGoogleSearch,
      thinkingLevel,
      safetySettings,
    } = req.body;

    const ai = getAiClient();

    const config: Record<string, any> = {};
    if (systemInstruction && systemInstruction.trim().length > 0) {
      config.systemInstruction = systemInstruction.trim();
    }
    if (typeof temperature === "number") config.temperature = temperature;
    if (typeof topP === "number") config.topP = topP;
    if (typeof topK === "number") config.topK = topK;
    if (typeof maxOutputTokens === "number" && maxOutputTokens > 0) {
      config.maxOutputTokens = maxOutputTokens;
    }
    if (responseMimeType) config.responseMimeType = responseMimeType;
    if (responseSchema) config.responseSchema = responseSchema;
    if (enableGoogleSearch) config.tools = [{ googleSearch: {} }];
    if (thinkingLevel && model.includes("3.")) {
      config.thinkingConfig = { thinkingLevel };
    }
    if (safetySettings) config.safetySettings = safetySettings;

    let formattedContents: any = contents;
    if (Array.isArray(contents)) {
      formattedContents = contents.map((turn: any) => {
        if (typeof turn === "string") return turn;
        const parts: any[] = [];
        if (turn.text) parts.push({ text: turn.text });
        if (turn.files && Array.isArray(turn.files)) {
          for (const file of turn.files) {
            if (file.data && file.mimeType) {
              parts.push({
                inlineData: {
                  mimeType: file.mimeType,
                  data: file.data.replace(/^data:[^;]+;base64,/, ""),
                },
              });
            }
          }
        }
        return {
          role: turn.role || "user",
          parts: parts.length > 0 ? parts : [{ text: "" }],
        };
      });
    }

    const response = await ai.models.generateContent({
      model,
      contents: formattedContents,
      config,
    });

    res.json({
      text: response.text || "",
      groundingMetadata: response.candidates?.[0]?.groundingMetadata || null,
      usageMetadata: response.usageMetadata || null,
      finishReason: response.candidates?.[0]?.finishReason || "STOP",
    });
  } catch (error: any) {
    console.error("Error during generation:", error);
    res.status(500).json({
      error: error.message || "Failed to generate content with Gemini API",
    });
  }
});

// Real token counting endpoint
app.post("/api/count-tokens", async (req, res) => {
  try {
    const { model = "gemini-3.7-flash", contents, systemInstruction } = req.body;
    const ai = getAiClient();

    let formattedContents: any = contents;
    if (typeof contents === "string") {
      formattedContents = contents;
    } else if (Array.isArray(contents)) {
      formattedContents = contents.map((turn: any) => {
        if (typeof turn === "string") return turn;
        const parts: any[] = [];
        if (turn.text) parts.push({ text: turn.text });
        return {
          role: turn.role || "user",
          parts: parts.length > 0 ? parts : [{ text: "" }],
        };
      });
    }

    const countResult = await ai.models.countTokens({
      model,
      contents: formattedContents || "",
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    res.json({
      totalTokens: countResult.totalTokens || 0,
      cachedContentTokenCount: countResult.cachedContentTokenCount || 0,
    });
  } catch (error: any) {
    // Fallback heuristic estimation: ~4 chars per token
    const textLength = JSON.stringify(req.body.contents || "").length;
    const est = Math.max(1, Math.ceil(textLength / 4));
    res.json({
      totalTokens: est,
      isEstimated: true,
      errorNote: error.message,
    });
  }
});

// Transcribe audio using Gemini
app.post("/api/transcribe", async (req, res) => {
  try {
    const { audioData, mimeType = "audio/webm" } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: "Missing audioData in request body." });
    }

    const ai = getAiClient();
    const cleanBase64 = audioData.replace(/^data:[^;]+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: "Transcribe this audio precisely. Return only the transcribed text.",
          },
        ],
      },
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Transcription error:", error);
    res.status(500).json({
      error: error.message || "Failed to transcribe audio.",
    });
  }
});

// Vite middleware & Static serving setup
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Google AI Studio app running on port ${PORT}`);
  });
}

start();
