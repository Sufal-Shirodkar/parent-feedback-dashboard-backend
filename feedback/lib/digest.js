const { listFeedback } = require("./model");
const { canAccessFeedback } = require("../helpers/access");

const GEMINI_ENDPOINTS = [
  "https://generativelanguage.googleapis.com/v1beta",
  "https://generativelanguage.googleapis.com/v1",
];

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
].filter(Boolean);

function getCurrentWeekRange(now = new Date()) {
  const end = new Date(now);
  const daysFromMonday = (end.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate() - daysFromMonday,
    0,
    0,
    0,
    0
  ));

  return { start, end };
}

function toDigestItem(feedback) {
  return {
    rating: feedback.rating,
    continuing: feedback.continuing,
    contactRequested: Boolean(feedback.contactRequested),
    comments: feedback.comments || "",
    class: feedback.classLabel,
    priority: feedback.priority,
  };
}

function isInWeek(createdAt, start, end) {
  if (!createdAt) {
    return false;
  }

  const date = new Date(createdAt);
  return date >= start && date <= end;
}

function emptyDigest() {
  return {
    overallVibe: "No feedback was submitted this week.",
    urgentFires: [],
    bigThemes: [],
    highPriorityFlags: [],
  };
}

function parseGeminiDigest(text) {
  const parsed = JSON.parse(text);

  return {
    overallVibe: String(parsed.overallVibe || parsed.overall_vibe || "").trim(),
    urgentFires: Array.isArray(parsed.urgentFires)
      ? parsed.urgentFires.map(String)
      : Array.isArray(parsed.urgent_fires)
        ? parsed.urgent_fires.map(String)
        : [],
    bigThemes: Array.isArray(parsed.bigThemes)
      ? parsed.bigThemes.map(String)
      : Array.isArray(parsed.big_themes)
        ? parsed.big_themes.map(String)
        : [],
    highPriorityFlags: Array.isArray(parsed.highPriorityFlags)
      ? parsed.highPriorityFlags.map(String)
      : Array.isArray(parsed.high_priority_flags)
        ? parsed.high_priority_flags.map(String)
        : [],
  };
}

function buildPrompt(items) {
  return [
    "You are writing a concise weekly staff digest for Contour Education coordinators.",
    "Use only the feedback items provided. Do not invent names or contact details.",
    "Return JSON only with these keys:",
    "overallVibe (string), urgentFires (string array), bigThemes (string array), highPriorityFlags (string array).",
    "1. overallVibe: one or two sentences on the week's tone.",
    "2. urgentFires: same-day issues (low ratings, urgent priority, parents asking for contact).",
    "3. bigThemes: recurring topics from comments and classes.",
    "4. highPriorityFlags: high/urgent items and non-continuation (continuing = No).",
    "Keep each bullet short.",
    "",
    "Feedback items:",
    JSON.stringify(items),
  ].join("\n");
}

function geminiHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
}

function modelId(name) {
  return String(name || "").replace(/^models\//, "");
}

async function listGeminiModels(apiKey, baseUrl) {
  const response = await fetch(`${baseUrl}/models`, {
    headers: geminiHeaders(apiKey),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const apiStatus = errorBody.error?.status || errorBody.error?.message || response.status;
    throw new Error(`Gemini model list failed: HTTP ${response.status} ${apiStatus}`);
  }

  const payload = await response.json();

  return (payload.models || [])
    .filter((model) => (model.supportedGenerationMethods || []).includes("generateContent"))
    .map((model) => modelId(model.name))
    .filter(Boolean);
}

function isTextDigestModel(name) {
  const id = modelId(name).toLowerCase();

  if (!id || /tts|image|imagen|embed|audio|veo|robotics/.test(id)) {
    return false;
  }

  return /gemini/.test(id);
}

function preferFlashModels(models) {
  return [...models].sort((a, b) => {
    const rank = (name) => {
      if (/flash-latest$/i.test(name)) return 0;
      if (/flash-lite-latest$/i.test(name)) return 1;
      if (/flash-lite/i.test(name)) return 2;
      if (/flash/i.test(name)) return 3;
      return 4;
    };

    return rank(a) - rank(b);
  });
}

function selectGeminiModels(listed) {
  const textModels = listed.filter(isTextDigestModel);
  const merged = [...new Set([...FALLBACK_MODELS, ...textModels])].filter(isTextDigestModel);

  return preferFlashModels(merged);
}

async function generateWithModel(apiKey, baseUrl, model, prompt) {
  const response = await fetch(`${baseUrl}/models/${model}:generateContent`, {
    method: "POST",
    headers: geminiHeaders(apiKey),
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    }),
  });

  if (response.ok) {
    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      const error = new Error("Gemini returned an empty digest");
      error.code = "GEMINI_EMPTY";
      throw error;
    }

    return parseGeminiDigest(text);
  }

  const errorBody = await response.json().catch(() => ({}));
  const apiStatus = errorBody.error?.status || errorBody.error?.message || response.status;
  const error = new Error(`Gemini request failed: HTTP ${response.status} ${apiStatus}`);
  error.status = response.status;
  throw error;
}

async function generateDigestWithGemini(items) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY is not configured");
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }

  const prompt = buildPrompt(items);
  let lastError = "Gemini request failed";

  for (const baseUrl of GEMINI_ENDPOINTS) {
    let models = FALLBACK_MODELS;

    try {
      const listed = await listGeminiModels(apiKey, baseUrl);
      if (listed.length > 0) {
        models = selectGeminiModels(listed);
        console.log(`Gemini text models: ${models.slice(0, 6).join(", ")}`);
      }
    } catch (error) {
      lastError = error.message;
      console.error(lastError);
    }

    for (const model of models) {
      try {
        return await generateWithModel(apiKey, baseUrl, model, prompt);
      } catch (error) {
        lastError = error.message;
        console.error(`${lastError} (${model})`);

        if (error.code === "GEMINI_EMPTY") {
          throw error;
        }

        if (error.status === 401 || error.status === 403 || error.status === 429) {
          break;
        }
      }
    }
  }

  const error = new Error(lastError);
  error.code = "GEMINI_REQUEST_FAILED";
  throw error;
}

async function getWeeklyDigest(user) {
  const { start, end } = getCurrentWeekRange();

  const weekItems = (await listFeedback())
    .filter((item) => canAccessFeedback(user, item))
    .filter((item) => isInWeek(item.createdAt, start, end))
    .map(toDigestItem);

  if (weekItems.length === 0) {
    return {
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      feedbackCount: 0,
      digest: emptyDigest(),
    };
  }

  const digest = await generateDigestWithGemini(weekItems);

  return {
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    feedbackCount: weekItems.length,
    digest,
  };
}

module.exports = {
  getWeeklyDigest,
  getCurrentWeekRange,
  toDigestItem,
  isInWeek,
  emptyDigest,
  parseGeminiDigest,
  isTextDigestModel,
  selectGeminiModels,
};
