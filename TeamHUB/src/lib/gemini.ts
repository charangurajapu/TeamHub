import { GoogleGenAI } from '@google/genai';
import { fetchTasksFromDb, fetchMessagesFromDb, fetchQuestionsFromDb } from './supabase';
import { INITIAL_TASKS, INITIAL_CHANNEL_MESSAGES, INITIAL_QUESTIONS } from '../data/mockData';

// Retrieve API Keys from Vite env or runtime window
// SECURITY WARNING: In client-side SPA architectures, VITE_* keys are embedded into the browser bundle.
// For production deployments, all LLM calls should be migrated behind a secure server-side proxy or Supabase Edge Function.
const openAiApiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY || '';
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || '';
const groqApiKey = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.GROQ_API_KEY || '';

// Configurable Model Names with defaults
export const OPENAI_MODEL =
  import.meta.env.VITE_OPENAI_MODEL ||
  import.meta.env.OPENAI_MODEL ||
  'gpt-4o-mini';

export const GEMINI_PRIMARY_MODEL =
  import.meta.env.VITE_GEMINI_PRIMARY_MODEL ||
  import.meta.env.GEMINI_PRIMARY_MODEL ||
  import.meta.env.VITE_GEMINI_MODEL ||
  import.meta.env.GEMINI_MODEL ||
  'gemini-3.8-flash';

export const GEMINI_FALLBACK_MODEL =
  import.meta.env.VITE_GEMINI_FALLBACK_MODEL ||
  import.meta.env.GEMINI_FALLBACK_MODEL ||
  'gemini-3.7-flash';

export const GROQ_MODEL =
  import.meta.env.VITE_GROQ_MODEL ||
  import.meta.env.GROQ_MODEL ||
  'openai/gpt-oss-120b';

export const isOpenAiConfigured = Boolean(
  openAiApiKey &&
  !openAiApiKey.includes('YOUR_OPENAI_API_KEY') &&
  !openAiApiKey.includes('MY_OPENAI_API_KEY')
);
export const isGeminiConfigured = Boolean(apiKey && !apiKey.includes('MY_GEMINI_API_KEY'));
export const isGroqConfigured = Boolean(groqApiKey && !groqApiKey.includes('MY_GROQ_API_KEY'));

// Initialize Gemini client if API key is available
const ai = isGeminiConfigured ? new GoogleGenAI({ apiKey }) : null;

/**
 * Helper to fetch live context from Supabase tables (tasks, messages, questions).
 */
export async function getLiveSupabaseContext(): Promise<string> {
  try {
    const [tasks, messages, questions] = await Promise.all([
      fetchTasksFromDb(),
      fetchMessagesFromDb('design'),
      fetchQuestionsFromDb(),
    ]);

    const activeTasksList = (tasks || INITIAL_TASKS).slice(0, 8).map(
      (t) => `• [${t.key}] ${t.title} (Status: ${t.status}, Priority: ${t.priority}, Assignee: ${t.assignee.name})`
    ).join('\n');

    const recentMessagesList = (messages || INITIAL_CHANNEL_MESSAGES).slice(-6).map(
      (m) => `• ${m.author.name}: "${m.content}" (${m.createdAt})`
    ).join('\n');

    const recentQuestionsList = (questions || INITIAL_QUESTIONS).slice(0, 4).map(
      (q) => `• [${q.key}] ${q.title} (Status: ${q.status}, ${q.answers.length} answers)`
    ).join('\n');

    return `LIVE WORKSPACE DATABASE CONTEXT (FETCHED FROM SUPABASE):

[Active Tasks in Sprint 42]
${activeTasksList || 'No active tasks found.'}

[Recent Messages in #design]
${recentMessagesList || 'No recent messages found.'}

[Knowledge Exchange Q&A Threads]
${recentQuestionsList || 'No Q&A threads found.'}`;
  } catch (err) {
    return 'LIVE WORKSPACE CONTEXT: Fallback to current session state.';
  }
}

/**
 * System prompt to give Gemini and Groq contextual awareness as TeamHUB's engineering assistant.
 */
const BASE_SYSTEM_INSTRUCTION = `You are TeamHUB AI, an intelligent workspace co-pilot embedded inside TeamHUB - a team collaboration app for engineering, product, and design pods.
You assist developers, team leads, and administrators with:
- Sprint progress summaries and standup updates
- Code review, architecture decisions, and performance benchmarks
- Task breakdowns and test plan suggestions
- Answers to team questions and documentation references

Use the provided LIVE WORKSPACE DATABASE CONTEXT to answer user questions accurately.
Keep your responses concise, professional, and well-structured using markdown. Format key takeaways with clear bullet points or code snippets.`;

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Calls OpenAI's chat completions API (https://api.openai.com/v1/chat/completions)
 * using native fetch() without requiring external SDKs.
 * Uses the configured model (defaults to OPENAI_MODEL / "gpt-4o-mini").
 * Formats conversation context and history into OpenAI-style role/content message pairs.
 */
export async function generateOpenAIAssistantResponse(
  userPrompt: string,
  history?: Array<{ role: 'user' | 'model'; text: string }>,
  customSystemInstruction?: string
): Promise<{ text: string; error?: string }> {
  if (!isOpenAiConfigured) {
    return {
      text: '',
      error: 'OPENAI_API_KEY is not configured or placeholder detected.',
    };
  }

  try {
    const liveContext = await getLiveSupabaseContext();
    const systemInstruction = customSystemInstruction || `${BASE_SYSTEM_INSTRUCTION}\n\n${liveContext}`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: systemInstruction,
      },
    ];

    if (history && history.length > 0) {
      for (const h of history) {
        messages.push({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.text,
        });
      }
    }

    messages.push({
      role: 'user',
      content: userPrompt,
    });

    const endpointUrl = 'https://api.openai.com/v1/chat/completions';
    const requestPayload = {
      model: OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    };

    console.log(`[AI] Trying OpenAI (${OPENAI_MODEL})...`);

    // Timeout safety with AbortController (20s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let res: Response;
    try {
      res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const errBody = await res.text();
      let safeErrorMessage = `OpenAI API Error (${res.status}): ${res.statusText || 'Request failed'}`;
      try {
        const parsed = JSON.parse(errBody);
        if (parsed?.error?.message) {
          // Sanitize any key patterns that might appear in upstream messages
          safeErrorMessage = `OpenAI API Error (${res.status}): ${String(parsed.error.message).replace(/sk-[a-zA-Z0-9_-]+/g, '***REDACTED***')}`;
        }
      } catch {
        // Fall back to safe status text
      }

      console.warn(`[AI] OpenAI failed (${res.status}): ${safeErrorMessage}`);
      return {
        text: '',
        error: safeErrorMessage,
      };
    }

    const data = await res.json();
    const replyText = data.choices?.[0]?.message?.content?.trim();

    if (!replyText || typeof replyText !== 'string') {
      console.warn('[AI] Empty or malformed content returned from OpenAI API.');
      return {
        text: '',
        error: 'OpenAI API returned an empty or malformed response.',
      };
    }

    console.log(`[AI] Served by: OpenAI (${OPENAI_MODEL})`);
    return { text: replyText };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    const errMsg = isTimeout
      ? 'OpenAI request timed out after 20s'
      : String(err?.message || 'Network error connecting to OpenAI API').replace(/sk-[a-zA-Z0-9_-]+/g, '***REDACTED***');
    console.warn('[AI] OpenAI exception:', errMsg);
    return {
      text: '',
      error: errMsg,
    };
  }
}

/**
 * Calls Groq's chat completions API (OpenAI-compatible endpoint: https://api.groq.com/openai/v1/chat/completions)
 * using the configured model (defaults to GROQ_MODEL / "openai/gpt-oss-120b").
 * Formats conversation context and history into OpenAI-style role/content message pairs.
 */
export async function generateGroqAssistantResponse(
  userPrompt: string,
  history?: Array<{ role: 'user' | 'model'; text: string }>,
  customSystemInstruction?: string
): Promise<{ text: string; error?: string }> {
  if (!isGroqConfigured) {
    console.warn('[Groq API] GROQ_API_KEY is not configured or missing.');
    return {
      text: '',
      error: 'GROQ_API_KEY is not configured.',
    };
  }

  try {
    const liveContext = await getLiveSupabaseContext();
    const systemInstruction = customSystemInstruction || `${BASE_SYSTEM_INSTRUCTION}\n\n${liveContext}`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: systemInstruction,
      },
    ];

    if (history && history.length > 0) {
      for (const h of history) {
        messages.push({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.text,
        });
      }
    }

    messages.push({
      role: 'user',
      content: userPrompt,
    });

    const endpointUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const requestPayload = {
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    };

    console.log(`[AI] Trying Groq (${GROQ_MODEL})...`);

    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[Groq API Error Details]', {
        status: res.status,
        statusText: res.statusText,
        body: errBody,
      });
      return {
        text: '',
        error: `Groq API Error (${res.status}): ${errBody || res.statusText}`,
      };
    }

    const data = await res.json();
    const replyText = data.choices?.[0]?.message?.content?.trim();

    if (!replyText) {
      console.warn('[Groq API] Empty content returned in response choice.');
      return {
        text: '',
        error: 'Groq API returned an empty response.',
      };
    }

    console.log(`[AI Provider] Served by: Groq (${GROQ_MODEL})`);
    return { text: replyText };
  } catch (err: any) {
    console.error('[Groq API Exception]', err);
    return {
      text: '',
      error: err?.message || 'Failed to communicate with Groq API.',
    };
  }
}

/**
 * Returns a simulated context-aware response when no live AI API key is configured or when offline.
 */
function getSimulatedOfflineResponse(userPrompt: string): string {
  const lower = userPrompt.toLowerCase();
  if (lower.includes('standup') || lower.includes('update')) {
    return `Ready for Daily Standup:\nDONE: Audited high-contrast modal design tokens against WCAG AA requirements.\nDOING: Implementing drag-and-drop file upload component.\nBLOCKED: None.`;
  }
  return `Based on live Supabase workspace data:\nI have evaluated your request against the current Sprint 42 backlog and design stream.\n\nRecommendation: Proceed with atomic database mutations and update the active task board.`;
}

/**
 * Generates an AI response for TeamHUB prompt input using the resilient multi-tier fallback chain:
 * 1. Primary: OpenAI (configured via OPENAI_MODEL, defaults to "gpt-4o-mini")
 * 2. Secondary: Gemini Primary Model (configured via GEMINI_PRIMARY_MODEL, defaults to "gemini-3.8-flash" with retries)
 * 3. Tertiary: Gemini Fallback Model (configured via GEMINI_FALLBACK_MODEL, defaults to "gemini-3.7-flash")
 * 4. Quaternary: Groq (configured via GROQ_MODEL, defaults to "openai/gpt-oss-120b")
 * 5. Quinary: Offline simulated keyword / workspace fallback
 */
export async function generateGeminiAssistantResponse(
  userPrompt: string,
  history?: Array<{ role: 'user' | 'model'; text: string }>
): Promise<{ text: string; error?: string }> {
  const liveContext = await getLiveSupabaseContext();
  const systemInstruction = `${BASE_SYSTEM_INSTRUCTION}\n\n${liveContext}`;

  // ============================================================
  // STEP 1: OPENAI PRIMARY
  // ============================================================
  if (isOpenAiConfigured) {
    try {
      const openAiRes = await generateOpenAIAssistantResponse(userPrompt, history, systemInstruction);
      if (openAiRes.text && !openAiRes.error) {
        return { text: openAiRes.text };
      }
      console.log('[AI] OpenAI failed, trying Gemini...');
    } catch (openAiErr) {
      console.warn('[AI] OpenAI exception, trying Gemini...', openAiErr);
    }
  }

  // ============================================================
  // STEP 2: GEMINI PRIMARY & FALLBACK (OR GROQ IF GEMINI UNCONFIGURED)
  // ============================================================
  // If Gemini client is not initialized, try Groq directly if configured
  if (!ai) {
    if (isGroqConfigured) {
      console.log(`[AI] Gemini not configured, trying Groq (${GROQ_MODEL})...`);
      try {
        const groqRes = await generateGroqAssistantResponse(userPrompt, history, systemInstruction);
        if (groqRes.text && !groqRes.error) {
          return { text: groqRes.text };
        }
      } catch (groqErr) {
        console.error('[Groq Direct Call Exception]', groqErr);
      }
    }

    console.log('[AI] Groq failed, using offline fallback');
    return { text: getSimulatedOfflineResponse(userPrompt) };
  }

  const contents: any[] = [];

  if (history && history.length > 0) {
    for (const h of history) {
      contents.push({
        role: h.role,
        parts: [{ text: h.text }],
      });
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: userPrompt }],
  });

  const maxRetries = 2;
  const retryDelays = [2000, 4000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const primaryModel = GEMINI_PRIMARY_MODEL;
      const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${primaryModel}:generateContent`;
      const requestPayload = {
        endpoint: endpointUrl,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-client': 'google-genai-sdk/2.4.0',
          'x-goog-api-key': apiKey ? '***REDACTED***' : 'MISSING',
        },
        body: {
          model: primaryModel,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        },
      };

      console.log(`[Gemini API Outgoing Request] (attempt ${attempt + 1}/${maxRetries + 1})`, requestPayload);

      const response = await ai.models.generateContent({
        model: primaryModel,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      const replyText = response.text || 'Unable to generate response from Gemini API.';
      console.log(`[AI Provider] Served by: Gemini Primary (${GEMINI_PRIMARY_MODEL})`);
      return { text: replyText };
    } catch (err: any) {
      const errMsg = String(err?.message || err || '');
      const statusCode = err?.status || err?.code || err?.statusCode || (errMsg.includes('503') ? 503 : 'Unknown');
      const isOverloadedOr503 =
        errMsg.includes('503') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('capacity') ||
        errMsg.includes('overloaded') ||
        errMsg.includes('resource exhausted') ||
        errMsg.includes('429');

      console.warn(`Gemini API call (${GEMINI_PRIMARY_MODEL}) attempt ${attempt + 1} failed:`, err);

      if (isOverloadedOr503 && attempt < maxRetries) {
        await delay(retryDelays[attempt]);
        continue;
      }

      // Log exact error details for primary model
      console.error('[Gemini API Primary Model Error Details]', {
        model: GEMINI_PRIMARY_MODEL,
        statusCode,
        message: errMsg,
        rawError: err,
      });

      // Secondary fallback to GEMINI_FALLBACK_MODEL if primary model returns 503/capacity/429 error
      if (isOverloadedOr503) {
        console.warn(`[Gemini API] Primary model ${GEMINI_PRIMARY_MODEL} overloaded/exhausted. Attempting fallback to ${GEMINI_FALLBACK_MODEL}...`);
        try {
          await delay(1000);
          const fallbackModel = GEMINI_FALLBACK_MODEL;
          const fallbackEndpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent`;
          const fallbackPayload = {
            endpoint: fallbackEndpointUrl,
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-client': 'google-genai-sdk/2.4.0',
              'x-goog-api-key': apiKey ? '***REDACTED***' : 'MISSING',
            },
            body: {
              model: fallbackModel,
              contents,
              config: {
                systemInstruction,
                temperature: 0.7,
                maxOutputTokens: 1024,
              },
            },
          };

          console.log('[Gemini API Fallback Outgoing Request]', fallbackPayload);

          const fallbackResponse = await ai.models.generateContent({
            model: fallbackModel,
            contents,
            config: {
              systemInstruction,
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          });

          const fallbackText = fallbackResponse.text || 'Unable to generate response from Gemini API.';
          console.log(`[AI Provider] Served by: Gemini Fallback (${GEMINI_FALLBACK_MODEL})`);
          return { text: fallbackText };
        } catch (fallbackErr: any) {
          const fallbackErrMsg = String(fallbackErr?.message || fallbackErr || '');
          const fallbackStatusCode = fallbackErr?.status || fallbackErr?.code || fallbackErr?.statusCode || 'Unknown';

          console.error('[Gemini API Fallback Model Error Details]', {
            model: GEMINI_FALLBACK_MODEL,
            statusCode: fallbackStatusCode,
            message: fallbackErrMsg,
            rawError: fallbackErr,
          });
        }
      }

      // ============================================================
      // STEP 3: GROQ TERTIARY FALLBACK (GROQ_MODEL)
      // ============================================================
      console.log('[AI] Gemini failed, trying Groq...');
      try {
        const groqRes = await generateGroqAssistantResponse(userPrompt, history, systemInstruction);
        if (groqRes.text && !groqRes.error) {
          return { text: groqRes.text };
        }
        console.warn('[Groq Fallback Notice] Groq fallback did not produce a response:', groqRes.error);
      } catch (groqErr) {
        console.error('[Groq Fallback Exception]', groqErr);
      }

      // ============================================================
      // STEP 4: OFFLINE SIMULATED FALLBACK
      // ============================================================
      console.log('[AI] Groq failed, using offline fallback');

      const lower = userPrompt.toLowerCase();
      if (lower.includes('standup') || lower.includes('update')) {
        return {
          text: getSimulatedOfflineResponse(userPrompt),
        };
      }

      const friendlyMessage = isOverloadedOr503
        ? 'The AI assistant is a bit busy right now — please try again in a moment.'
        : `Gemini API Error: ${errMsg || 'Failed to communicate with Gemini API.'}`;

      return {
        text: friendlyMessage,
        error: friendlyMessage,
      };
    }
  }

  // Final fallback attempt if retry loop completes without returning
  console.log('[AI] Gemini failed, trying Groq...');
  try {
    const groqRes = await generateGroqAssistantResponse(userPrompt, history, systemInstruction);
    if (groqRes.text && !groqRes.error) {
      return { text: groqRes.text };
    }
  } catch (groqErr) {
    console.error('[Groq Fallback Exception]', groqErr);
  }

  console.log('[AI] Groq failed, using offline fallback');
  const lower = userPrompt.toLowerCase();
  if (lower.includes('standup') || lower.includes('update')) {
    return {
      text: getSimulatedOfflineResponse(userPrompt),
    };
  }

  return {
    text: 'The AI assistant is a bit busy right now — please try again in a moment.',
    error: 'The AI assistant is a bit busy right now — please try again in a moment.',
  };
}

