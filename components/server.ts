import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";

// Initialize Gemini client on server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper to generate the "Permanent Memory" context
const buildContextPrompt = (prefs: any) => {
  const lowerGrades = ["Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];
  let toneInstruction = "Tone: Clear, academic but accessible, supportive. Act like a helpful tutor.";
  if (lowerGrades.includes(prefs.grade)) {
    toneInstruction = "Tone: Playful, warm, encouraging, simple words. Use emojis 🌟. Act like a friendly primary school teacher.";
  } else if (prefs.grade === "Lifelong Learner" || prefs.grade === "Undergraduate") {
    toneInstruction = "Tone: Professional, concise, respectful, adult-oriented learning.";
  }

  return `
  IDENTITY & PERMANENT MEMORY:
  You are Samaveshi, a Universal Learning Bridge.
  
  CURRENT USER PROFILE:
  - Name: ${prefs.name}
  - Grade/Level: ${prefs.grade}
  - Native Language: ${prefs.language}
  - Location/Context: ${prefs.location}
  - Specific Needs: ${prefs.disability}

  STRICT ADAPTATION RULES (MUST FOLLOW):
  1. LANGUAGE: All output text MUST be in ${prefs.language}. If a term is technical, keep it in English but explain it in ${prefs.language}.
  2. TONE & COMPLEXITY: ${toneInstruction}
  3. CULTURAL CONTEXT: Use analogies and examples relevant to ${prefs.location}.
  4. ACCESSIBILITY OVERRIDE:
     ${prefs.disability === "VISUAL" ? "- USER IS BLIND/VISUALLY IMPAIRED. Do not use phrases like 'look at', 'see here'. Describe spatial relationships, textures, and sounds vividly. Focus on 'What is where'." : ""}
     ${prefs.disability === "HEARING" ? "- USER IS DEAF/HARD OF HEARING. Describe sounds visually (e.g., [loud bang], [whispering]). Focus on visual context and emotional expressions." : ""}
     ${prefs.disability === "DYSLEXIA" ? "- USER HAS READING DIFFICULTY. Use bullet points, short sentences, and bold keywords. Avoid dense paragraphs. Use simple sans-serif-friendly formatting." : ""}
  
  Now, perform the specific analysis task below based on this profile.
  `;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route: Healthcheck
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Route: Analyze Content
  app.post("/api/analyze-content", async (req, res) => {
    try {
      const { inputData, mimeType, mode, prefs } = req.body;
      if (!inputData || !mimeType || !mode || !prefs) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let systemPrompt = buildContextPrompt(prefs);
      let schema: any;
      let modelName = "gemini-3.5-flash";

      if (mode === "HEAR_IMAGES") {
        systemPrompt += `
          TASK: Analyze this visual input (image/video) for the user defined in your profile (${prefs.disability} focus).
          1. Identify the core topic.
          2. Provide a 'spatialDescription'.
             - If VISUAL impairment: Be extremely descriptive about layout (top-left, center). Describe colors and textures.
             - If Puzzle/Question: Describe the problem but DO NOT solve it unless asked.
          3. Suggest a creative 'tactileModelSuggestion' using everyday items found in ${prefs.location}.
          4. Suggest 3 follow-up questions appropriate for ${prefs.grade}.
        `;
        schema = {
          type: Type.OBJECT,
          properties: {
            mode: { type: Type.STRING },
            topic: { type: Type.STRING },
            spatialDescription: { type: Type.STRING },
            tactileModelSuggestion: { type: Type.STRING },
            followUpSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["topic", "spatialDescription", "tactileModelSuggestion"],
        };
      } else if (mode === "SEE_SOUND") {
        systemPrompt += `
          TASK: Analyze this audio/video input for the user defined in your profile (${prefs.disability} focus).
          1. Provide a 'transcript' with VISUAL CUES for sounds/tones (e.g. [Sarcastic tone], [Door slams]).
          2. Identify 'emotionalTone'.
          3. Provide a 'summary' in ${prefs.language}.
          4. List 'keyTerms'.
          5. Suggest 3 follow-up questions.
        `;
        schema = {
          type: Type.OBJECT,
          properties: {
            mode: { type: Type.STRING },
            topic: { type: Type.STRING },
            transcript: { type: Type.STRING },
            summary: { type: Type.STRING },
            emotionalTone: { type: Type.STRING },
            keyTerms: { type: Type.ARRAY, items: { type: Type.STRING } },
            followUpSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["topic", "transcript", "summary", "emotionalTone"],
        };
      } else if (mode === "EASY_READ") {
        systemPrompt += `
          TASK: Simplify this input for the user defined in your profile (${prefs.disability} / ${prefs.grade}).
          1. Identify topic.
          2. Provide 'simplifiedText'.
             - STRICTLY follow the Dyslexia rules if applicable.
             - Use short, clear sentences.
          3. Provide 'analogies' mapping concepts to ${prefs.location}.
          4. Create a 'quiz' with 3 simple questions.
          5. Suggest 3 follow-up questions.
        `;
        schema = {
          type: Type.OBJECT,
          properties: {
            mode: { type: Type.STRING },
            topic: { type: Type.STRING },
            simplifiedText: { type: Type.STRING },
            analogies: { type: Type.STRING },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                },
              },
            },
            followUpSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["topic", "simplifiedText", "quiz"],
        };
      } else if (mode === "CLASS_PACK") {
        systemPrompt += `
          TASK: Generate teaching resources based on this input.
          1. Identify topic.
          2. Generate 'studentNotes' in ${prefs.language} suitable for ${prefs.grade}.
          3. Generate 'parentSummary' for WhatsApp.
          4. Suggest 3 follow-up questions.
        `;
        schema = {
          type: Type.OBJECT,
          properties: {
            mode: { type: Type.STRING },
            topic: { type: Type.STRING },
            studentNotes: { type: Type.STRING },
            parentSummary: { type: Type.STRING },
            followUpSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["topic", "studentNotes", "parentSummary"],
        };
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: inputData,
              },
            },
            { text: systemPrompt },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });

      const text = response.text;
      if (!text) throw new Error("No response from Gemini");

      const result = JSON.parse(text);
      result.mode = mode;
      res.json(result);
    } catch (error: any) {
      console.error("Express Analyze Content failed:", error);
      res.status(500).json({ error: error.message || "Analysis failed" });
    }
  });

  // API Route: Generate Speech
  app.post("/api/generate-speech", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing text for speech" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Puck" },
            },
          },
        },
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
      res.json({ audioBase64 });
    } catch (error: any) {
      console.error("Express Speech generation failed:", error);
      res.status(500).json({ error: error.message || "Speech generation failed" });
    }
  });

  // API Route: Transcribe Audio
  app.post("/api/transcribe-audio", async (req, res) => {
    try {
      const { audioBase64, language } = req.body;
      if (!audioBase64 || !language) {
        return res.status(400).json({ error: "Missing audioBase64 or language" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "audio/webm",
                data: audioBase64,
              },
            },
            { text: `Transcribe this audio exactly in ${language}. Return only the transcription text, nothing else.` },
          ],
        },
      });

      res.json({ text: response.text?.trim() || "" });
    } catch (error: any) {
      console.error("Express Transcription failed:", error);
      res.status(500).json({ error: error.message || "Transcription failed" });
    }
  });

  // API Route: Send Chat Message
  app.post("/api/send-chat-message", async (req, res) => {
    try {
      const { history, newMessage, audioBase64, context, prefs } = req.body;

      const permanentContext = buildContextPrompt(prefs);
      let analyzedContentContext = `
      REFERENCE CONTENT:
      Topic: ${context.topic}
      ${context.spatialDescription ? `Image Description: ${context.spatialDescription}` : ""}
      ${context.tactileModelSuggestion ? `Tactile Idea: ${context.tactileModelSuggestion}` : ""}
      ${context.transcript ? `Transcript: ${context.transcript}` : ""}
      ${context.simplifiedText ? `Simplified Text: ${context.simplifiedText}` : ""}
      ${context.studentNotes ? `Notes: ${context.studentNotes}` : ""}
      `;

      const systemInstruction = `
        ${permanentContext}
        
        CONTEXT FOR THIS CHAT:
        ${analyzedContentContext}
        
        CHAT INSTRUCTIONS:
        - Answer questions using the Reference Content.
        - Stick to the Persona (Tone/Language) defined above.
        - Maintain conversation history context.
      `;

      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        history: history.map((h: any) => ({
          role: h.role,
          parts: [{ text: h.text }],
        })),
        config: {
          systemInstruction,
        },
      });

      let parts: any[] = [];
      if (audioBase64) {
        parts.push({
          inlineData: {
            mimeType: "audio/webm",
            data: audioBase64,
          },
        });
      }
      if (newMessage) {
        parts.push({ text: newMessage });
      }

      if (parts.length === 0) {
        return res.status(400).json({ error: "Message cannot be empty" });
      }

      const result = await chat.sendMessage({
        message: parts,
      });

      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Express Send Chat Message failed:", error);
      res.status(500).json({ error: error.message || "Send chat message failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
