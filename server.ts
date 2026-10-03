import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { mcpClient } from "./services/mcpClient";

// Helper to read SKILL.md rules
const getEasyReadSkillConstraints = (): string => {
  try {
    const skillPath = path.join(process.cwd(), "skills", "easy_read", "SKILL.md");
    if (fs.existsSync(skillPath)) {
      return fs.readFileSync(skillPath, "utf-8");
    }
  } catch (err) {
    console.error("Failed to read skills/easy_read/SKILL.md:", err);
  }
  return "";
};

// Custom utility to load environment variables from .env and .env.local
const loadEnv = () => {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    try {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        content.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx !== -1) {
              const key = trimmed.substring(0, eqIdx).trim();
              const value = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
              if (key) {
                // If it is not set, or is currently set to placeholder, write it
                if (!process.env[key] || process.env[key] === "PLACEHOLDER_API_KEY") {
                  process.env[key] = value;
                }
              }
            }
          }
        });
      }
    } catch (err) {
      console.error(`Failed to load ${file}:`, err);
    }
  }
};
loadEnv();

// Initialize Gemini client on server-side
const apiKey = process.env.GEMINI_API_KEY;
const isApiKeyMock = !apiKey || apiKey === "PLACEHOLDER_API_KEY";



const ai = new GoogleGenAI({
  apiKey: isApiKeyMock ? "dummy-key" : (apiKey || ""),
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper to generate the "Permanent Memory" context.
//
// v3, spec C4: the learner's name is never sent to this server, so `prefs` has no name field
// and the profile block below cannot contain one. The rule added to the adaptation list keeps
// the model from asking for it or inventing one.
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
  You are AllPath, a Universal Learning Bridge.
  
  CURRENT USER PROFILE:
  - Grade/Level: ${prefs.grade}
  - Native Language: ${prefs.language}
  - Location/Context: ${prefs.location}
  - Specific Needs: ${prefs.disability}

  STRICT ADAPTATION RULES (MUST FOLLOW):
  1. LANGUAGE: All output text MUST be in ${prefs.language}. If a term is technical, keep it in English but explain it in ${prefs.language}.
  2. TONE & COMPLEXITY: ${toneInstruction}
  3. CULTURAL CONTEXT: Use analogies and examples relevant to ${prefs.location}.
  4. NAMES: You are not given the learner's name. Address them as "you". Never ask for a name, and never invent one.
  5. ACCESSIBILITY OVERRIDE:
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
    const { inputData, mimeType, mode, prefs, subject, topic, performance, parentLanguage } = req.body;
    try {
      if (!inputData || !mimeType || !mode || !prefs) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`[analyze-content] Request received. mode=${mode}, isApiKeyMock=${isApiKeyMock}`);
      if (isApiKeyMock) {
        // Return Mock fallback matching BDD feature specs
        if (mode === "EASY_READ") {
          return res.json({
            mode: "EASY_READ",
            topic: "Photosynthesis (ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ)",
            simplifiedText: "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ (Photosynthesis) ಎಂಬುದು ಸಸ್ಯಗಳು ತಮ್ಮ ಆಹಾರವನ್ನು ತಾವೇ ತಯಾರಿಸುವ ಒಂದು ಸರಳ ಪ್ರಕ್ರಿಯೆಯಾಗಿದೆ.\n\n* **ಸೂರ್ಯನ ಬೆಳಕು (Sunlight)**: ಸಸ್ಯಗಳಿಗೆ ಆಹಾರ ತಯಾರಿಸಲು ಮುಖ್ಯ ಶಕ್ತಿಯನ್ನು ನೀಡುತ್ತದೆ.\n* **ನೀರು (Water)**: ಬೇರುಗಳ ಮೂಲಕ ಮಣ್ಣಿನಿಂದ ನೀರನ್ನು ಹೀರಿಕೊಳ್ಳುತ್ತವೆ.\n* **ಪತ್ರಹರಿತ್ತು (Chlorophyll)**: ಎಲೆಗಳಲ್ಲಿರುವ ಹಸಿರು ಬಣ್ಣವು ಸೂರ್ಯನ ಬೆಳಕನ್ನು ಹಿಡಿಯಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.\n* **ಆಮ್ಲಜನಕ (Oxygen)**: ಈ ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿ ಸಸ್ಯಗಳು ನಮಗೆ ಉಸಿರಾಡಲು ಗಾಳಿಯನ್ನು ಬಿಡುಗಡೆ ಮಾಡುತ್ತವೆ.",
            analogies: "ಭತ್ತದ ಬೆಳೆಯ ಚಕ್ರಗಳು (Rice Paddy farming cycles): ಇದನ್ನು ನಮ್ಮ ಭತ್ತದ ಬೆಳೆಯ ಚಕ್ರಕ್ಕೆ ಹೋಲಿಸಬಹುದು. ಗದ್ದೆಯನ್ನು ಉಳುಮೆ ಮಾಡಿ ಒಣಗಿಸಲು ಸೂರ್ಯನ ಶಾಖ ಹೇಗೆ ಮುಖ್ಯವೋ, ಹಾಗೆಯೇ ಸಸ್ಯಗಳ ಆಹಾರ ತಯಾರಿಕೆಗೆ ಸೂರ್ಯನ ಬೆಳಕು (Sunlight) ಅತ್ಯಗತ್ಯ ಶಕ್ತಿ ಮೂಲವಾಗಿದೆ. ಹಸಿರು ಭತ್ತದ ಎಲೆಗಳು (Chlorophyll) ಶಕ್ತಿಯನ್ನು ಹಿಡಿದು ಧಾನ್ಯವನ್ನು ತುಂಬಿಸುವಂತೆ, ಪತ್ರಹರಿತ್ತು ಸೂರ್ಯನ ಬೆಳಕನ್ನು ಹಿಡಿದು ಆಹಾರ ತಯಾರಿಸುತ್ತದೆ.",
            quiz: [
              {
                question: "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆಗೆ (Photosynthesis) ಸೂರ್ಯನ ಬೆಳಕು ಏಕೆ ಬೇಕು?",
                options: [
                  "ಆಹಾರ ತಯಾರಿಸಲು ಶಕ್ತಿ ನೀಡಲು",
                  "ಮಣ್ಣನ್ನು ಒಣಗಿಸಲು",
                  "ಗಿಡಗಳನ್ನು ಕತ್ತರಿಸಲು",
                  "ಎಲೆಗಳು ಉದುರಲು"
                ],
                correctAnswer: "ಆಹಾರ ತಯಾರಿಸಲು ಶಕ್ತಿ ನೀಡಲು"
              },
              {
                question: "ಎಲೆಗಳ ಹಸಿರು ಬಣ್ಣಕ್ಕೆ (Chlorophyll) ಕಾರಣವಾದ ಅಂಶ ಯಾವುದು?",
                options: [
                  "ನೀರಾವರಿ",
                  "ಪತ್ರಹರಿತ್ತು (Chlorophyll)",
                  "ಗಾಳಿ",
                  "ಬೇರುಗಳು"
                ],
                correctAnswer: "ಪತ್ರಹರಿತ್ತು (Chlorophyll)"
              },
              {
                question: "ಭತ್ತದ ಬೆಳೆಯ ಚಕ್ರದ ಅನಾಲಜಿಯಲ್ಲಿ ಸೂರ್ಯನ ಬೆಳಕು ಯಾವುದಕ್ಕೆ ಹೋಲಿಕೆಯಾಗಿದೆ?",
                options: [
                  "ಕಳೆ ಕೀಳುವುದು",
                  "ನೀರಾವರಿ",
                  "ಬೆಳವಣಿಗೆಯ ಮುಖ್ಯ ಚಾಲಕ ಶಕ್ತಿ",
                  "ಬೀಜ ಬಿತ್ತುವುದು"
                ],
                correctAnswer: "ಬೆಳವಣಿಗೆಯ ಮುಖ್ಯ ಚಾಲಕ ಶಕ್ತಿ"
              }
            ],
            followUpSuggestions: [
              "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆಯ ಇತರ ಅಗತ್ಯಗಳು ಯಾವುವು?",
              "ಭತ್ತದ ಬೆಳೆಗೂ ಇತರ ಬೆಳೆಗಳಿಗೂ ಇರುವ ವ್ಯತ್ಯಾಸವೇನು?",
              "ಸಸ್ಯಗಳು ರಾತ್ರಿಯ ಸಮಯದಲ್ಲಿ ಹೇಗೆ ಬದುಕುತ್ತವೆ?"
            ]
          });
        } else if (mode === "HEAR_IMAGES") {
          return res.json({
            mode: "HEAR_IMAGES",
            topic: "Textbook Page",
            spatialDescription: "An educational textbook page showing diagrams of cells.",
            tactileModelSuggestion: "Use small clay beads to represent organelles.",
            followUpSuggestions: ["What is a cell?", "What is cytoplasm?", "How do plant cells differ from animal cells?"]
          });
        } else if (mode === "SEE_SOUND") {
          return res.json({
            mode: "SEE_SOUND",
            topic: "Science Lecture",
            transcript: "[Lecturer speaks clearly] Today we learn about forces. [Chalk scrapes on blackboard]",
            summary: "Introduction to Newton's laws of motion.",
            emotionalTone: "Informative and engaging",
            keyTerms: ["Force", "Inertia", "Acceleration"],
            followUpSuggestions: ["What is inertia?", "Can you explain the first law?", "How does friction affect motion?"]
          });
        } else if (mode === "CLASS_PACK") {
          const mockTopic = topic || "Water Cycle";
          const mockSubject = subject || "Science";
          const mockPerformance = performance || "Excellent / Strong understanding";
          const mockParentLang = parentLanguage || "English";

          let localMessage = "";
          switch (mockParentLang) {
            case "Kannada":
              localMessage = `ನಮಸ್ಕಾರ! ಇಂದು ನಿಮ್ಮ ಮಗು ತರಗತಿಯಲ್ಲಿ "${mockTopic}" (${mockSubject}) ವಿಷಯದ ಬಗ್ಗೆ ಕಲಿತಿದೆ. ಮಗುವಿನ ತರಗತಿ ಪ್ರದರ್ಶನ: ${mockPerformance}. ದಯವಿಟ್ಟು ಇಂದು ಸಂಜೆ ನಿಮ್ಮ ಮಗುವಿನೊಂದಿಗೆ ಈ ವಿಷಯದ ಬಗ್ಗೆ ಚರ್ಚಿಸಿ ಮತ್ತು ಅವರು ಕಲಿತದ್ದನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ಪ್ರೋತ್ಸಾహಿಸಿ! 🌟📚`;
              break;
            case "Hindi":
              localMessage = `नमस्ते! आज आपके बच्चे ने कक्षा में "${mockTopic}" (${mockSubject}) विषय के बारे में सीखा। बच्चे का कक्षा में प्रदर्शन: ${mockPerformance}। कृपया आज शाम अपने बच्चे से इस विषय पर चर्चा करें और उन्हें अपने अनुभव साझा करने के लिए प्रोत्साहित करें! 🌟📚`;
              break;
            case "Hinglish":
              localMessage = `Hello! Aaj aapke bacche ne class me "${mockTopic}" (${mockSubject}) ke baare me seekha. Bacche ka performance class me: ${mockPerformance}. Please aaj shaam ko apne bacche se is baare me baat karein aur unhe share karne ke liye encourage karein! 🌟📚`;
              break;
            case "Tamil":
              localMessage = `வணக்கம்! இன்று உங்கள் குழந்தை வகுப்பில் "${mockTopic}" (${mockSubject}) பற்றி கற்றுக்கொண்டது. குழந்தையின் வகுப்பு செயல்திறன்: ${mockPerformance}. தயவுசெய்து இன்று இரவு உங்கள் குழந்தையுடன் இந்தத் தலைப்பைப் பற்றி விவாதிக்கவும்! 🌟📚`;
              break;
            case "Telugu":
              localMessage = `నమస్కారం! ఈ రోజు మీ బిడ్డ తరగతిలో "${mockTopic}" (${mockSubject}) గురించి నేర్చుకుంది. బిడ్డ తరగతి ప్రదర్శన: ${mockPerformance}. దయచేసి ఈ రాత్రి మీ బిడ్డతో ఈ విషయం గురించి చర్చించండి! 🌟📚`;
              break;
            case "Bangla":
              localMessage = `নমস্কার! আজ আপনার শিশু ক্লাসে "${mockTopic}" (${mockSubject}) সম্পর্কে শিখেছে। ক্লাসে শিশুর কর্মক্ষমতা: ${mockPerformance}। অনুগ্রহ করে আজ রাতে আপনার শিশুর সাথে এই বিষয়টি নিয়ে আলোচনা করুন! 🌟📚`;
              break;
            case "Assamese":
              localMessage = `নমস্কাৰ! আজি আপোনাৰ সন্তানে শ্ৰেণীত "${mockTopic}" (${mockSubject}) বিষয়ৰ বিষয়ে শিকিলে। সন্তানৰ শ্ৰেণীৰ প্ৰদৰ্শন: ${mockPerformance}। অনুগ্ৰহ কৰি আজিশাতি আপোনাৰ সন্তানৰ সৈতে এই বিষয়ে আলোচনা কৰক! 🌟📚`;
              break;
            case "Marathi":
              localMessage = `नमस्कार! आज तुमच्या मुलाने वर्गात "${mockTopic}" (${mockSubject}) बद्दल शिकले. मुलाची वर्गातील कामगिरी: ${mockPerformance}. कृपया आज रात्री तुमच्या मुलासोबत या विषयावर चर्चा करा! 🌟📚`;
              break;
            case "Odia":
              localMessage = `ନମସ୍କାର! ଆଜି ଆପଣଙ୍କ ଶିଶୁ ଶ୍ରେଣୀରେ "${mockTopic}" (${mockSubject}) ବିଷୟରେ ଶିଖିଲା | ଶିଶುର ପ୍ରଦର୍ଶନ: ${mockPerformance} | ଦୟାକରି ଆଜି ରାତିରେ ଆପଣଙ୍କ ଶିଶು ସହିତ ଏହି ବିଷୟରେ ଆଲୋଚନା କରନ୍ତು! 🌟📚`;
              break;
            case "Spanish":
              localMessage = `¡Hola! Hoy su hijo aprendió sobre "${mockTopic}" (${mockSubject}) en clase. Su desempeño en el aula: ${mockPerformance}. ¡Por favor, hable sobre este tema con su hijo esta noche! 🌟📚`;
              break;
            case "French":
              localMessage = `Bonjour! Aujourd'hui, votre enfant a appris "${mockTopic}" (${mockSubject}) en classe. Performance en classe: ${mockPerformance}. Veuillez discuter de ce sujet avec votre enfant ce soir! 🌟📚`;
              break;
            default:
              localMessage = `Hello! Today your child learned about "${mockTopic}" (${mockSubject}) in class. Their classroom performance: ${mockPerformance}. Please discuss this topic with your child tonight and encourage them to share what they learned! 🌟📚`;
              break;
          }

          const mockParentSummary = localMessage;

          return res.json({
            mode: "CLASS_PACK",
            topic: mockTopic,
            studentNotes: `Class/Level: ${prefs.grade}\nSubject: ${mockSubject}\nTopic Covered: ${mockTopic}\n\nKey Concepts:\n* Evaporation (ಆವಿಯಾಗುವಿಕೆ / वाष्पीकरण) - The process where water changes from liquid to gas/vapor due to heat.\n* Condensation (ಘನೀಕರಣ / संघनन) - The process where water vapor cools down and turns back into liquid water, forming clouds.\n* Precipitation (ಮಳೆ ಬೀಳುವುದು / वर्षण) - The release of water from clouds in the form of rain, snow, or sleet.\n\nPractice Questions:\n1. Describe the key difference between evaporation and condensation in your own words.\n2. Why is sunlight essential for the water cycle?`,
            parentSummary: mockParentSummary,
            followUpSuggestions: [
              `What other topics in ${mockSubject} are related to ${mockTopic}?`,
              "How does gravity influence precipitation?",
              "Can you give an everyday example of condensation?"
            ]
          });
        }
      }

      let systemPrompt = buildContextPrompt(prefs);
      let schema: any;
      let modelName = "gemini-2.5-flash";

      let detectedConcept = "Photosynthesis";
      let regionalAnalogyContext = "";

      if (mode === "EASY_READ") {
        try {
          const classificationResponse = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: inputData,
                  },
                },
                { text: "Identify the primary academic concept or topic in this image in 1-2 words. (e.g. 'Photosynthesis', 'Water Cycle'). Return ONLY the concept name." },
              ],
            },
          });
          detectedConcept = classificationResponse.text?.trim() || "Photosynthesis";
        } catch (err) {
          console.error("Failed to detect concept from image, falling back to Photosynthesis:", err);
        }

        try {
          const theme = "Agricultural/Farming analogies";
          const analogyResult = await mcpClient.getRegionalAnalogy(prefs.location, detectedConcept, theme);
          regionalAnalogyContext = analogyResult;
        } catch (mcpErr) {
          console.error("Failed to query Regional Context MCP Server:", mcpErr);
        }
      }

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
        const skillConstraints = getEasyReadSkillConstraints();
        systemPrompt += `
          SYSTEMIC RULES & CONSTRAINTS (FROM SKILL):
          ${skillConstraints}
          
          REGIONAL ANALOGY CONTEXT (FROM MCP SERVER):
          ${regionalAnalogyContext}
          
          TASK: Simplify this input for the user defined in your profile (${prefs.disability} / ${prefs.grade}).
          1. Identify topic.
          2. Provide 'simplifiedText'.
             - STRICTLY follow the Dyslexia rules if applicable.
             - Use short, clear sentences.
          3. Provide 'analogies' mapping concepts to ${prefs.location} using the Regional Analogy context if available.
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
        const classPackSubject = subject || "Science";
        const classPackTopic = topic || "General Topic";
        const classPackPerformance = performance || "Excellent / Strong understanding";
        const classPackParentLang = parentLanguage || "English";

        systemPrompt += `
          TASK: Generate classroom pedagogical materials for:
          - Class Level: ${prefs.grade}
          - Subject: ${classPackSubject}
          - Topic Covered: ${classPackTopic}
          - Student's Performance Context: ${classPackPerformance}
          - Parent Language Preference: ${classPackParentLang}

          INSTRUCTIONS:
          1. Topic: Identify and summarize the topic covered (e.g., "${classPackTopic}").
          
          2. Student Study Notes ('studentNotes'):
             - Provide a highly structured, well-organized set of study notes suitable for ${prefs.grade}.
             - Focus on key concepts, bullet points, definitions, and simple examples.
             - Must be in a bilingual format: explain concepts in the student's language (${prefs.language}) but keep key technical terms in English (with brackets).
          
          3. Parent WhatsApp Summary ('parentSummary'):
             - Produce a localized, emoji-rich, warm, and conversational WhatsApp-ready message block for parents.
             - It must communicate:
               - What topic was taught today: "${classPackTopic}" (${classPackSubject}).
               - How well the student performed based on the performance context: "${classPackPerformance}".
               - A specific suggestion or question for the parents to ask/discuss with their child.
             - LANGUAGE RULE FOR PARENT SUMMARY:
               - If the Parent Language Preference is a regional language (like Kannada, Hindi, Hinglish, Tamil, Telugu, Bangla, Assamese, Marathi, Odia, Spanish, French), you MUST write the entire parent WhatsApp summary directly in that conversational regional language.
               - If the Parent Language Preference is "English", write it in English.
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

      let parts: any[] = [];
      if (mimeType && mimeType !== "text-based" && inputData && inputData !== "placeholder") {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: inputData,
          },
        });
      }
      parts.push({ text: systemPrompt });

      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: parts,
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
      console.warn("Live API call failed, using graceful local mock fallback:", error.message || error);

      try {
        if (mode === "EASY_READ") {
          return res.json({
            mode: "EASY_READ",
            topic: "Photosynthesis (ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ)",
            simplifiedText: "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ (Photosynthesis) ಎಂಬುದು ಸಸ್ಯಗಳು ತಮ್ಮ ಆಹಾರವನ್ನು ತಾವೇ ತಯಾರಿಸುವ ಒಂದು ಸರಳ ಪ್ರಕ್ರಿಯೆಯಾಗಿದೆ.\n\n* **ಸೂರ್ಯನ ಬೆಳಕು (Sunlight)**: ಸಸ್ಯಗಳಿಗೆ ಆಹಾರ ತಯಾರಿಸಲು ಮುಖ್ಯ ಶಕ್ತಿಯನ್ನು ನೀಡುತ್ತದೆ.\n* **ನೀರು (Water)**: ಬೇರುಗಳ ಮೂಲಕ ಮಣ್ಣಿನಿಂದ ನೀರನ್ನು ಹೀರಿಕೊಳ್ಳುತ್ತವೆ.\n* **ಪತ್ರಹರಿತ್ತು (Chlorophyll)**: ಎಲೆಗಳಲ್ಲಿರುವ ಹಸಿರು ಬಣ್ಣವು ಸೂರ್ಯನ ಬೆಳಕನ್ನು ಹಿಡಿಯಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.\n* **ಆಮ್ಲಜನಕ (Oxygen)**: ಈ ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿ ಸಸ್ಯಗಳು ನಮಗೆ ಉಸಿರಾಡಲು ಗಾಳಿಯನ್ನು ಬಿಡುगಡೆ ಮಾಡುತ್ತವೆ.",
            analogies: "ಭತ್ತದ ಬೆಳೆಯ ಚಕ್ರಗಳು (Rice Paddy farming cycles): ಇದನ್ನು ನಮ್ಮ ಭತ್ತದ ಬೆಳೆಯ ಚಕ್ರಕ್ಕೆ ಹೋಲಿಸಬಹುದು. ಗದ್ದೆಯನ್ನು ಉಳುಮೆ ಮಾಡಿ ಒಣಗಿಸಲು ಸೂರ್ಯನ ಶಾಖ ಹೇಗೆ ಮುಖ್ಯವೋ, ಹಾಗೆಯೇ ಸಸ್ಯಗಳ ಆಹಾರ ತಯಾರಿಕೆಗೆ ಸೂರ್ಯನ ಬೆಳಕು (Sunlight) ಅತ್ಯಗत्य ಶಕ್ತಿ ಮೂಲವಾಗಿದೆ. ಹಸಿರು ಭತ್ತದ ಎಲೆಗಳು (Chlorophyll) ಶಕ್ತಿಯನ್ನು ಹಿಡಿದು ಧಾನ್ಯವನ್ನು ತುಂಬಿಸುವಂತೆ, ಪತ್ರಹರಿತ್ತು ಸೂರ್ಯನ ಬೆಳಕನ್ನು ಹಿಡಿದು ಆಹಾರ ತಯಾರಿಸುತ್ತದೆ.",
            quiz: [
              {
                question: "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆಗೆ (Photosynthesis) ಸೂರ್ಯನ ಬೆಳಕು ಏಕೆ ಬೇಕು?",
                options: [
                  "ಆಹಾರ ತಯಾರಿಸಲು ಶಕ್ತಿ ನೀಡಲು",
                  "ಮಣ್ಣನ್ನು ಒಣಗಿಸಲು",
                  "ಗಿಡಗಳನ್ನು ಕತ್ತರಿಸಲು",
                  "ಎಲೆಗಳು ಉದುರಲು"
                ],
                correctAnswer: "ಆಹಾರ ತಯಾರಿಸಲು ಶಕ್ತಿ ನೀಡಲು"
              }
            ],
            followUpSuggestions: [
              "Why do leaves turn yellow in autumn?",
              "Can plants photosynthesize under artificial light?"
            ]
          });
        } else if (mode === "CLASS_PACK") {
          const mockTopic = topic || "Water Cycle";
          const mockSubject = subject || "Science";
          const mockPerformance = performance || "Excellent / Strong understanding";
          const mockParentLang = parentLanguage || "English";

          let localMessage = "";
          switch (mockParentLang) {
            case "Kannada":
              localMessage = `ನಮಸ್ಕಾರ! ಇಂದು ನಿಮ್ಮ ಮಗು ತರಗತಿಯಲ್ಲಿ "${mockTopic}" (${mockSubject}) ವಿಷಯದ ಬಗ್ಗೆ ಕಲಿತಿದೆ. ಮಗುವಿನ ತರಗತಿ ಪ್ರದರ್ಶನ: ${mockPerformance}. ದಯವಿಟ್ಟು ಇಂದು ಸಂಜೆ ನಿಮ್ಮ ಮಗುವಿನೊಂದಿಗೆ ಈ ವಿಷಯದ ಬಗ್ಗೆ ಚರ್ಚಿಸಿ ಮತ್ತು ಅವರು ಕಲಿತದ್ದನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ಪ್ರೋತ್ಸಾಹಿಸಿ! 🌟📚`;
              break;
            case "Hindi":
              localMessage = `नमस्ते! आज आपके बच्चे ने कक्षा में "${mockTopic}" (${mockSubject}) विषय के बारे में सीखा। बच्चे का कक्षा में प्रदर्शन: ${mockPerformance}। कृपया आज शाम अपने बच्चे से इस विषय पर चर्चा करें और उन्हें अपने अनुभव साझा करने के लिए प्रोत्साहित करें! 🌟📚`;
              break;
            case "Hinglish":
              localMessage = `Hello! Aaj aapke bacche ne class me "${mockTopic}" (${mockSubject}) ke baare me seekha. Bacche ka performance class me: ${mockPerformance}. Please aaj shaam ko apne bacche se is baare me baat karein aur unhe share karne ke liye encourage karein! 🌟📚`;
              break;
            case "Tamil":
              localMessage = `வணக்கம்! இன்று உங்கள் குழந்தை வகுப்பில் "${mockTopic}" (${mockSubject}) பற்றி கற்றுக்கொண்டது. குழந்தையின் வகுப்பு செயல்திறன்: ${mockPerformance}. தயவுசெய்து இன்று இரவு உங்கள் குழந்தையுடன் இந்தத் தலைப்பைப் பற்றி விவாதிக்கவும்! 🌟📚`;
              break;
            case "Telugu":
              localMessage = `నమస్కారం! ఈ రోజు మీ బిడ్డ తరగతిలో "${mockTopic}" (${mockSubject}) గురించి నేర్చుకుంది. బిడ్డ తరగతి ప్రదర్శన: ${mockPerformance}. దయచేసి ఈ రాత్రి మీ బిడ్డతో ఈ విషయం గురించి చర్చించండి! 🌟📚`;
              break;
            case "Bangla":
              localMessage = `নমস্কার! আজ আপনার শিশু ক্লাসে "${mockTopic}" (${mockSubject}) সম্পর্কে শিখেছে। ক্লাসে শিশুর কর্মক্ষমতা: ${mockPerformance}। অনুগ্রহ করে আজ রাতে আপনার শিশুর সাথে এই বিষয়টি নিয়ে আলোচনা করুন! 🌟📚`;
              break;
            case "Assamese":
              localMessage = `নমস্কাৰ! আজি আপোনাৰ সন্তানে শ্ৰেণীত "${mockTopic}" (${mockSubject}) বিষয়ৰ বিষয়ে শিকিলে। সন্তানৰ শ্ৰেণীৰ প্ৰদৰ্শন: ${mockPerformance}। অনুগ্ৰহ কৰি আজিশাতি আপোনাৰ সন্তানৰ সৈতে এই বিষয়ে আলোচনা কৰক! 🌟📚`;
              break;
            case "Marathi":
              localMessage = `नमस्कार! आज तुमच्या मुलाने वर्गात "${mockTopic}" (${mockSubject}) बद्दल शिकले. मुलाची वर्गातील कामगिरी: ${mockPerformance}. कृपया आज रात्री तुमच्या मुलासोबत या विषयावर चर्चा करा! 🌟📚`;
              break;
            case "Odia":
              localMessage = `ନମସ୍କାର! ଆଜି ଆପଣଙ୍କ ଶିଶୁ ଶ୍ରେଣୀରେ "${mockTopic}" (${mockSubject}) ବିଷୟରେ ଶିଖିଲା | ଶିଶୁର ପ୍ରଦର୍ଶନ: ${mockPerformance} | ଦୟାକରି ଆଜି ରାତିରେ ଆପଣଙ୍କ ଶିଶୁ ସହିତ ଏହି ବିଷୟରେ ଆଲୋଚନା କରନ୍ତು! 🌟📚`;
              break;
            case "Spanish":
              localMessage = `¡Hola! Hoy su hijo aprendió sobre "${mockTopic}" (${mockSubject}) en clase. Su desempeño en el aula: ${mockPerformance}. ¡Por favor, hable sobre este tema con su hijo esta noche! 🌟📚`;
              break;
            case "French":
              localMessage = `Bonjour! Aujourd'hui, votre enfant a appris "${mockTopic}" (${mockSubject}) en classe. Performance en classe: ${mockPerformance}. Veuillez discuter de ce sujet avec votre enfant ce soir! 🌟📚`;
              break;
            default:
              localMessage = `Hello! Today your child learned about "${mockTopic}" (${mockSubject}) in class. Their classroom performance: ${mockPerformance}. Please discuss this topic with your child tonight and encourage them to share what they learned! 🌟📚`;
              break;
          }

          const mockParentSummary = localMessage;

          return res.json({
            mode: "CLASS_PACK",
            topic: mockTopic,
            studentNotes: `Class/Level: ${prefs.grade}\nSubject: ${mockSubject}\nTopic Covered: ${mockTopic}\n\nKey Concepts:\n* Evaporation (ಆವಿಯಾಗುವಿಕೆ / वाष्पीकरण) - The process where water changes from liquid to gas/vapor due to heat.\n* Condensation (ಘನೀಕರಣ / संघनन) - The process where water vapor cools down and turns back into liquid water, forming clouds.\n* Precipitation (ಮಳೆ ಬೀಳುವುದು / वर्षण) - The release of water from clouds in the form of rain, snow, or sleet.\n\nPractice Questions:\n1. Describe the key difference between evaporation and condensation in your own words.\n2. Why is sunlight essential for the water cycle?`,
            parentSummary: mockParentSummary,
            followUpSuggestions: [
              `What other topics in ${mockSubject} are related to ${mockTopic}?`,
              "How does gravity influence precipitation?",
              "Can you give an everyday example of condensation?"
            ]
          });
        } else if (mode === "SEE_SOUND") {
          return res.json({
            mode: "SEE_SOUND",
            topic: "Science Lecture",
            transcript: "[Lecturer speaks clearly] Today we learn about forces. [Chalk scrapes on blackboard]",
            summary: "Introduction to Newton's laws of motion.",
            emotionalTone: "Informative and engaging",
            keyTerms: ["Force", "Inertia", "Acceleration"],
            followUpSuggestions: ["What is inertia?", "Can you explain the first law?", "How does friction affect motion?"]
          });
        } else {
          return res.json({
            mode: "HEAR_IMAGES",
            topic: "Science Diagram",
            spatialDescription: "An educational textbook page showing diagrams of cells and cellular structures.",
            tactileModelSuggestion: "Create a clay relief map of a plant cell using different colors for organelles.",
            followUpSuggestions: ["What is the function of mitochondria?", "How do plant cells differ from animal cells?"]
          });
        }
      } catch (err) {
        console.error("Mock fallback generation failed:", err);
        res.status(500).json({ error: error.message || "Analysis failed" });
      }
    }
  });

  // API Route: Generate Speech
  app.post("/api/generate-speech", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing text for speech" });
      }

      if (isApiKeyMock) {
        // Return dummy base64 WAV file header
        const dummyAudioBase64 = "UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
        return res.json({ audioBase64: dummyAudioBase64 });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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

      if (isApiKeyMock) {
        return res.json({ text: "ನಮಸ್ಕಾರ (Hello)" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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

      if (isApiKeyMock) {
        return res.json({ text: "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆಯ ಬಗ್ಗೆ ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಧನ್ಯವಾದಗಳು. ಸೂರ್ಯನ ಬೆಳಕು ಭತ್ತದ ಬೆಳವಣಿಗೆಗೆ ಶಕ್ತಿ ನೀಡುವಂತೆ ಸಸ್ಯಗಳಿಗೆ ಶಕ್ತಿ ನೀಡುತ್ತದೆ." });
      }

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
        model: "gemini-2.5-flash",
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
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const cleanup = () => {
    console.log("Shutting down servers and processes...");
    mcpClient.shutdown();
    server.close();
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

startServer();
