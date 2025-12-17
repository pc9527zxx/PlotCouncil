
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, AnalysisStatus, AnalysisUpdate, TeacherReview, ChairDecision } from "../types";
import { STUDENT_INSTRUCTION, TEACHER_STYLE_INSTRUCTION, TEACHER_LAYOUT_INSTRUCTION, TEACHER_DATA_INSTRUCTION, CHAIR_QA_INSTRUCTION, CHAIR_STRATEGY_INSTRUCTION, STUDENT_REVISION_INSTRUCTION, REVIEWER_LITE_INSTRUCTION } from "./prompts";

// ============================================================================
// Universal API Client - Supports both Google Gemini and OpenAI-compatible APIs
// ============================================================================

interface UniversalClientConfig {
  apiKey: string;
  baseUrl?: string;
  modelName: string;
}

interface ContentPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

// Detect if baseUrl is OpenAI-compatible (e.g., SiliconFlow, OpenRouter, etc.)
const isOpenAICompatible = (baseUrl?: string): boolean => {
  if (!baseUrl) return false;
  const url = baseUrl.toLowerCase();
  
  // Google APIs are NOT OpenAI-compatible, even though they have /v1beta
  if (url.includes('googleapis.com') || url.includes('generativelanguage')) {
    return false;
  }
  
  // Check for OpenAI-compatible patterns
  // /v1/ or /v1 at end (not /v1beta which is Google)
  const hasV1 = url.includes('/v1/') || url.endsWith('/v1') || url.includes('/v1?');
  
  return hasV1 || 
         url.includes('openai') || 
         url.includes('siliconflow') ||
         url.includes('openrouter') ||
         url.includes('together') ||
         url.includes('groq') ||
         url.includes('deepseek') ||
         url.includes('api.mistral') ||
         url.includes('api.anthropic');
};

// Convert Google-style parts to OpenAI messages
const convertToOpenAIMessages = (
  parts: ContentPart[],
  systemInstruction?: string
): any[] => {
  const messages: any[] = [];
  
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  const userContent: any[] = [];
  for (const part of parts) {
    if (part.text) {
      userContent.push({ type: 'text', text: part.text });
    } else if (part.inlineData) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        }
      });
    }
  }

  messages.push({ role: 'user', content: userContent });
  return messages;
};

// Get the backend proxy URL (same origin as the app, or from env)
const getProxyUrl = (): string => {
  // Check for environment variable first
  const envUrl = (import.meta as any).env?.VITE_RENDER_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  // Default to same origin (works when served from FastAPI backend)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:8000';
};

// Call OpenAI-compatible API via backend proxy (avoids CORS issues)
const callOpenAIViaProxy = async (
  config: UniversalClientConfig,
  parts: ContentPart[],
  systemInstruction?: string,
  temperature: number = 0.2
): Promise<string> => {
  const proxyUrl = getProxyUrl();
  const messages = convertToOpenAIMessages(parts, systemInstruction);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min timeout

  try {
    const response = await fetch(`${proxyUrl}/api/llm/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base_url: config.baseUrl,
        api_key: config.apiKey,
        model: config.modelName,
        messages,
        temperature,
        max_tokens: 16384,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `Proxy Error ${response.status}`);
    }

    const data = await response.json();
    return data.content || '';
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: The API took too long to respond (>5 min). Try a faster model.');
    }
    // Better error message for proxy connection failure
    if (error.message === 'Failed to fetch') {
      throw new Error(`Cannot connect to proxy server at ${proxyUrl}. Start backend: uvicorn server.main:app --reload`);
    }
    throw error;
  }
};

// Call OpenAI-compatible API directly (for APIs that support CORS)
const callOpenAIDirect = async (
  config: UniversalClientConfig,
  parts: ContentPart[],
  systemInstruction?: string,
  temperature: number = 0.2
): Promise<string> => {
  // Ensure baseUrl ends without trailing slash
  let baseUrl = config.baseUrl?.replace(/\/+$/, '') || '';
  // If baseUrl doesn't end with /chat/completions, append it
  const endpoint = baseUrl.includes('/chat/completions') 
    ? baseUrl 
    : `${baseUrl}/chat/completions`;

  const messages = convertToOpenAIMessages(parts, systemInstruction);

  // Create AbortController for timeout (10 minutes for large requests)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min timeout

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages,
        temperature,
        max_tokens: 16384,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout (>10 min). Try a faster model like gemini-2.0-flash or reduce image size.');
    }
    throw error;
  }
};

// Call OpenAI-compatible API with automatic fallback to proxy
const callOpenAICompatible = async (
  config: UniversalClientConfig,
  parts: ContentPart[],
  systemInstruction?: string,
  temperature: number = 0.2
): Promise<string> => {
  // First try direct call
  try {
    return await callOpenAIDirect(config, parts, systemInstruction, temperature);
  } catch (directError: any) {
    // If it's a CORS/network error, try the proxy
    if (directError.message === 'Failed to fetch' || 
        directError.message?.includes('NetworkError') ||
        directError.message?.includes('CORS')) {
      console.log('Direct API call failed (likely CORS), falling back to proxy...');
      try {
        return await callOpenAIViaProxy(config, parts, systemInstruction, temperature);
      } catch (proxyError: any) {
        // If proxy also fails, throw a helpful error
        throw new Error(
          `API call failed.\n` +
          `Direct: ${directError.message}\n` +
          `Proxy: ${proxyError.message}\n\n` +
          `Make sure the backend server is running: uvicorn server.main:app --reload`
        );
      }
    }
    // For non-CORS errors, just throw the original error
    throw directError;
  }
};

// Universal generate function
const universalGenerate = async (
  config: UniversalClientConfig,
  parts: ContentPart[],
  systemInstruction?: string,
  temperature: number = 0.2
): Promise<string> => {
  if (isOpenAICompatible(config.baseUrl)) {
    return callOpenAICompatible(config, parts, systemInstruction, temperature);
  }

  // Use Google GenAI SDK
  const clientOptions: { apiKey: string; baseURL?: string } = { apiKey: config.apiKey };
  if (config.baseUrl?.trim()) {
    clientOptions.baseURL = config.baseUrl.trim();
  }
  const client = new GoogleGenAI(clientOptions);

  const response = await client.models.generateContent({
    model: config.modelName,
    contents: { parts },
    config: { systemInstruction, temperature },
  });

  return response.text || '';
};

// ============================================================================

function handleError(error: any) {
    let message = "An unexpected error occurred.";
    if (error instanceof Error) {
        message = error.message;
        if (message.includes("403")) message = "Access Denied: API Key invalid.";
        if (message.includes("429")) message = "Rate Limit Exceeded.";
        if (message.includes("404")) message = "Model Not Found.";
        if (message.includes("503")) message = "Service Unavailable.";
    }
    throw new Error(message);
}

const extractJsonFromText = (raw?: string): any | null => {
    if (!raw) return null;
    const tryParse = (str: string) => {
        try {
            return JSON.parse(str);
        } catch {
            let cleaned = str.replace(/([^\\:]|^)\/\/.*$/gm, '$1');
            cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
            cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
            return JSON.parse(cleaned);
        }
    };

    const blockMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
    if (blockMatch && blockMatch[1]) {
        try {
            return tryParse(blockMatch[1]);
        } catch {
            return null;
        }
    }

    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const potential = raw.substring(firstBrace, lastBrace + 1);
        try {
            return tryParse(potential);
        } catch {
            return null;
        }
    }
    return null;
};

// === PHASE 1: STUDENT ONLY ===
export const analyzePlotImage = async (
  base64Image: string, 
  mimeType: string, 
  modelName: string,
  customApiKey?: string,
  onUpdate?: (update: AnalysisUpdate) => void,
  customBaseUrl?: string
): Promise<AnalysisResult> => {
  const finalApiKey = customApiKey?.trim() || process.env.API_KEY;

  if (!finalApiKey) {
    throw new Error("API Key is missing. Please enter a custom key in the settings menu.");
  }

  const config: UniversalClientConfig = {
    apiKey: finalApiKey,
    baseUrl: customBaseUrl?.trim(),
    modelName,
  };

  try {
    if (onUpdate) onUpdate({ status: AnalysisStatus.ANALYZING }); 
    
    console.log("Phase 1: Student Agent (Coder) Starting...");
    const parts: ContentPart[] = [
      { inlineData: { mimeType: mimeType, data: base64Image } },
      { text: "Analyze this scientific figure. First, provide a detailed VISUAL ANALYSIS (Axes, Data, Layout). Then, EXTRACT all data into the JSON schema and finally WRITE THE PYTHON CODE to replicate it." },
    ];

    const studentOutput = await universalGenerate(config, parts, STUDENT_INSTRUCTION, 0.2);
    if (!studentOutput) throw new Error("Student Agent returned empty response.");

    // RETURN EARLY - Let the App render this code first!
    return {
      markdown: studentOutput,
      timestamp: Date.now(),
    };

  } catch (error: any) {
    console.error("API Error details:", error);
    handleError(error);
    throw error; 
  }
};

// === PHASE 2 & 3: MULTI-TEACHER CRITIQUE + DUAL CHAIR REVIEW ===
export const refinePlotAnalysis = async (
  originalImageBase64: string,
  originalImageMime: string,
  currentPythonCode: string,
  feedback: { type: 'image' | 'error', data: string, mimeType?: string },
  modelName: string,
  customApiKey?: string,
  onUpdate?: (update: AnalysisUpdate) => void,
  options?: { preset?: 'lite' | 'full' },
  customBaseUrl?: string
): Promise<AnalysisResult> => {
  const finalApiKey = customApiKey?.trim() || process.env.API_KEY;
  if (!finalApiKey) throw new Error("API Key is missing.");

  const config: UniversalClientConfig = {
    apiKey: finalApiKey,
    baseUrl: customBaseUrl?.trim(),
    modelName,
  };

  try {
    const preset = options?.preset ?? 'full';

    const buildCompareParts = (): ContentPart[] => {
      const parts: ContentPart[] = [];
      if (feedback.type === 'image' && feedback.mimeType) {
        parts.push({ text: "IMAGE 1: ORIGINAL TARGET" });
        parts.push({ inlineData: { mimeType: originalImageMime, data: originalImageBase64 } });
        parts.push({ text: "IMAGE 2: STUDENT RENDER" });
        parts.push({ inlineData: { mimeType: feedback.mimeType, data: feedback.data } });
        parts.push({ text: "Compare ORIGINAL vs STUDENT." });
      } else {
        parts.push({ inlineData: { mimeType: originalImageMime, data: originalImageBase64 } });
        parts.push({ text: `The Student's code crashed or produced a blank plot. ERROR LOG:\n${feedback.data}` });
      }
      parts.push({ text: `CURRENT PYTHON CODE:\n\n\`\`\`python\n${currentPythonCode}\n\`\`\`` });
      return parts;
    };

    // ========================================================================
    // LITE PRESET: Student (initial) -> Lite Reviewer -> Student (revision)
    // ========================================================================
    if (preset === 'lite') {
      if (onUpdate) onUpdate({ status: AnalysisStatus.CHAIR_QA });
      const liteSummary = await universalGenerate(config, buildCompareParts(), REVIEWER_LITE_INSTRUCTION, 0.1);

      const liteJson = extractJsonFromText(liteSummary);
      const riskRaw = liteJson?.risk_score;
      const riskScore =
        typeof riskRaw === 'number'
          ? riskRaw
          : riskRaw !== undefined
            ? parseFloat(String(riskRaw))
            : undefined;
      const statusValue = typeof liteJson?.overall_status === 'string'
        ? liteJson.overall_status.toUpperCase()
        : 'UNKNOWN';
      const qaStatus: AnalysisResult['qaStatus'] =
        statusValue === 'APPROVED' || statusValue === 'NEEDS_REVISION' ? statusValue : 'UNKNOWN';
      const priorityFixes = Array.isArray(liteJson?.priority_fixes)
        ? liteJson.priority_fixes.map((fix: any) => (typeof fix === 'string' ? fix : JSON.stringify(fix)))
        : undefined;
      const studentBrief = Array.isArray(liteJson?.student_brief)
        ? liteJson.student_brief.map((x: any) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n')
        : (typeof liteJson?.student_brief === 'string' ? liteJson.student_brief : '');

      const chairFindings: ChairDecision[] = [
        { role: 'QA', summary: liteSummary, priorityFixes }
      ];

      // Send partial result with chair findings immediately
      if (onUpdate) {
        onUpdate({
          status: AnalysisStatus.REFINING,
          partialResult: {
            chairFindings,
            qaStatus,
            riskScore,
          }
        });
      }
      
      // Build student prompt parts - INCLUDE IMAGES for visual reference!
      const studentParts: ContentPart[] = [
        { text: "## ORIGINAL TARGET IMAGE (you must replicate this):" },
        { inlineData: { mimeType: originalImageMime, data: originalImageBase64 } },
      ];
      
      // Add student render if available
      if (feedback.type === 'image' && feedback.mimeType) {
        studentParts.push({ text: "## YOUR CURRENT RENDER (fix the issues found by reviewer):" });
        studentParts.push({ inlineData: { mimeType: feedback.mimeType, data: feedback.data } });
      }
      
      studentParts.push(
        { text: `## CURRENT PYTHON CODE:\n\`\`\`python\n${currentPythonCode}\n\`\`\`` },
        { text: `## LITE REVIEWER SUMMARY (must address ALL issues):\n${liteSummary}` },
        ...(studentBrief ? [{ text: `## STUDENT BRIEF:\n${studentBrief}` }] : []),
        { text: `
## ⚠️ IMPORTANT INSTRUCTIONS:
1. You MUST fix ALL issues listed in the reviewer summary
2. Look at the ORIGINAL TARGET IMAGE carefully for visual reference
3. Compare your render with the original to understand the exact visual differences
4. Output COMPLETE, RUNNABLE code - not just the changed parts
5. Make sure your code produces output that matches the ORIGINAL, not your previous render
` }
      );

      const studentRevisionText = await universalGenerate(config, studentParts, STUDENT_REVISION_INSTRUCTION, 0.05);
      if (!studentRevisionText) throw new Error("Student Coder returned an empty response.");

      return {
        markdown: studentRevisionText,
        teacherCritique: liteSummary,
        teacherReviews: [],
        chairFindings,
        qaStatus,
        riskScore,
        timestamp: Date.now(),
      };
    }

    const teacherAgents = [
      { role: 'STYLE' as const, instruction: TEACHER_STYLE_INSTRUCTION, status: AnalysisStatus.TEACHER_STYLE_REVIEW },
      { role: 'LAYOUT' as const, instruction: TEACHER_LAYOUT_INSTRUCTION, status: AnalysisStatus.TEACHER_LAYOUT_REVIEW },
      { role: 'DATA' as const, instruction: TEACHER_DATA_INSTRUCTION, status: AnalysisStatus.TEACHER_DATA_REVIEW },
    ];

    const buildTeacherPromptParts = (): ContentPart[] => {
      const parts: ContentPart[] = [];
      if (feedback.type === 'image' && feedback.mimeType) {
        parts.push({ text: "IMAGE 1: ORIGINAL TARGET" });
        parts.push({ inlineData: { mimeType: originalImageMime, data: originalImageBase64 } });
        parts.push({ text: "IMAGE 2: STUDENT RENDER" });
        parts.push({ inlineData: { mimeType: feedback.mimeType, data: feedback.data } });
        parts.push({ text: "Compare ORIGINAL vs STUDENT strictly per your role. Output actionable JSON." });
      } else {
        parts.push({ inlineData: { mimeType: originalImageMime, data: originalImageBase64 } });
        parts.push({ text: `The Student's code crashed. ERROR LOG:\n${feedback.data}\nDiagnose per your role and describe the visual impact.` });
      }
      return parts;
    };

    const teacherReviews: TeacherReview[] = [];
    for (const agent of teacherAgents) {
      if (onUpdate) onUpdate({ status: agent.status });
      const responseText = await universalGenerate(config, buildTeacherPromptParts(), agent.instruction, 0.1);
      teacherReviews.push({
        role: agent.role,
        findings: responseText || ''
      });
      // Send incremental update after each teacher completes
      if (onUpdate) {
        onUpdate({
          partialResult: {
            teacherReviews: [...teacherReviews],
          }
        });
      }
    }

    // ========================================================================
    // CHAIR QA SYNTHESIS
    // ========================================================================
    if (onUpdate) onUpdate({ status: AnalysisStatus.CHAIR_QA });
    const teacherJson = JSON.stringify(teacherReviews, null, 2);
    const qaParts: ContentPart[] = [
      { text: `TEACHER REVIEWS:\n${teacherJson}` },
      { text: `CURRENT PYTHON CODE:\n\`\`\`python\n${currentPythonCode}\n\`\`\`` }
    ];

    const qaSummary = await universalGenerate(config, qaParts, CHAIR_QA_INSTRUCTION, 0.1);

    const qaJson = extractJsonFromText(qaSummary);
    const qaRiskRaw = qaJson?.risk_score;
    const qaRisk =
      typeof qaRiskRaw === 'number'
        ? qaRiskRaw
        : qaRiskRaw !== undefined
          ? parseFloat(String(qaRiskRaw))
          : undefined;
    const qaStatusValue = typeof qaJson?.overall_status === 'string'
      ? qaJson.overall_status.toUpperCase()
      : 'UNKNOWN';
    const qaStatus: AnalysisResult['qaStatus'] =
      qaStatusValue === 'APPROVED' || qaStatusValue === 'NEEDS_REVISION' ? qaStatusValue : 'UNKNOWN';
    const qaPriorityFixes = Array.isArray(qaJson?.priority_fixes)
      ? qaJson.priority_fixes.map((fix: any) => (typeof fix === 'string' ? fix : JSON.stringify(fix)))
      : undefined;

    const chairFindings: ChairDecision[] = [
      { role: 'QA', summary: qaSummary, priorityFixes: qaPriorityFixes }
    ];

    // Send Chair QA update
    if (onUpdate) {
      onUpdate({
        partialResult: {
          chairFindings: [...chairFindings],
          qaStatus,
          riskScore: qaRisk,
        }
      });
    }

    // ========================================================================
    // CHAIR STRATEGY (Brief for Student)
    // ========================================================================
    if (onUpdate) onUpdate({ status: AnalysisStatus.CHAIR_STRATEGY });
    const strategyParts: ContentPart[] = [
      { text: `TEACHER REVIEWS:\n${teacherJson}` },
      { text: `QA SUMMARY:\n${qaSummary}` }
    ];

    const strategySummary = await universalGenerate(config, strategyParts, CHAIR_STRATEGY_INSTRUCTION, 0.1);

    const strategyJson = extractJsonFromText(strategySummary);
    const strategyActions = Array.isArray(strategyJson?.action_items)
      ? strategyJson.action_items.map((item: any) => {
          if (typeof item === 'string') return item;
          if (item?.detail) return item.detail;
          return JSON.stringify(item);
        })
      : undefined;
    chairFindings.push({ role: 'STRATEGY', summary: strategySummary, priorityFixes: strategyActions });

    // Send Chair Strategy update
    if (onUpdate) {
      onUpdate({
        status: AnalysisStatus.REFINING,
        partialResult: {
          chairFindings: [...chairFindings],
        }
      });
    }
    
    // Build student prompt parts - INCLUDE IMAGES for visual reference!
    const studentParts: ContentPart[] = [
      { text: "## ORIGINAL TARGET IMAGE (you must replicate this):" },
      { inlineData: { mimeType: originalImageMime, data: originalImageBase64 } },
    ];
    
    // Add student render if available
    if (feedback.type === 'image' && feedback.mimeType) {
      studentParts.push({ text: "## YOUR CURRENT RENDER (fix the issues found by reviewers):" });
      studentParts.push({ inlineData: { mimeType: feedback.mimeType, data: feedback.data } });
    }
    
    studentParts.push(
      { text: `## CURRENT PYTHON CODE:\n\`\`\`python\n${currentPythonCode}\n\`\`\`` },
      { text: `## TEACHER REVIEWS (must address ALL issues):\n${teacherJson}` },
      { text: `## QA SUMMARY:\n${qaSummary}` },
      { text: `## CHAIR STRATEGY BRIEF (your action items):\n${strategySummary}` },
      { text: `
## ⚠️ IMPORTANT INSTRUCTIONS:
1. You MUST fix ALL issues listed in the teacher reviews and chair strategy
2. Look at the ORIGINAL TARGET IMAGE carefully for visual reference
3. Compare your render with the original to understand the exact visual differences
4. Output COMPLETE, RUNNABLE code - not just the changed parts
5. Make sure your code produces output that matches the ORIGINAL, not your previous render
` }
    );

    const studentRevisionText = await universalGenerate(config, studentParts, STUDENT_REVISION_INSTRUCTION, 0.05);
    if (!studentRevisionText) throw new Error("Student Coder returned an empty response.");

    return {
      markdown: studentRevisionText,
      teacherCritique: qaSummary,
      teacherReviews,
      chairFindings,
      qaStatus,
      riskScore: qaRisk,
      timestamp: Date.now(),
    };

  } catch (error: any) {
    handleError(error);
    throw error;
  }
};

// ============================================================================
// Quick Error Fix - Skip teacher review, directly fix runtime errors
// ============================================================================

const QUICK_FIX_INSTRUCTION = `You are a Python debugging expert. The student's Matplotlib code crashed with an error.
Your task is to FIX THE ERROR and return working code.

CRITICAL RULES:
1. ONLY fix the specific error mentioned - do not change anything else
2. Keep all the styling, layout, and data representation intact
3. The fix should be minimal and targeted
4. Output the COMPLETE corrected Python code
5. Use ONLY matplotlib, numpy, and scipy - no other libraries

Common fixes:
- AttributeError: Check the correct method/property name for the matplotlib version
- TypeError: Check argument types and correct function signatures
- ValueError: Check data shapes and valid parameter values
- KeyError: Check dictionary keys and correct spellings

Output format:
\`\`\`python
# Your complete fixed code here
\`\`\`
`;

export const quickFixError = async (
  config: { apiKey: string; baseUrl?: string; modelId?: string },
  originalImageBase64: string,
  originalImageMime: string,
  currentPythonCode: string,
  errorText: string,
  onUpdate?: (update: AnalysisUpdate) => void
): Promise<AnalysisResult> => {
  if (!config.apiKey) {
    throw new Error("API key is missing. Please add your Gemini API key in settings.");
  }

  try {
    if (onUpdate) {
      onUpdate({ status: AnalysisStatus.REFINING });
    }

    const universalConfig: UniversalClientConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      modelName: config.modelId || 'gemini-2.0-flash',
    };

    const parts: ContentPart[] = [
      { text: "TARGET IMAGE (the plot we want to replicate):" },
      { inlineData: { mimeType: originalImageMime, data: originalImageBase64 } },
      { text: `CURRENT CODE THAT CRASHED:\n\`\`\`python\n${currentPythonCode}\n\`\`\`` },
      { text: `ERROR MESSAGE:\n\`\`\`\n${errorText}\n\`\`\`` },
      { text: "Fix this error and return the complete working code. Keep all styling intact." }
    ];

    const fixedCodeText = await universalGenerate(universalConfig, parts, QUICK_FIX_INSTRUCTION, 0.05);
    
    if (!fixedCodeText) {
      throw new Error("Quick fix returned empty response");
    }

    return {
      markdown: fixedCodeText,
      teacherCritique: `Auto-fixed error: ${errorText.slice(0, 200)}...`,
      teacherReviews: [],
      chairFindings: [{
        role: 'QA',
        summary: JSON.stringify({
          role: 'QuickFix',
          overall_status: 'AUTO_FIXED',
          error_fixed: errorText.slice(0, 500),
          fix_applied: true
        }, null, 2)
      }],
      qaStatus: 'UNKNOWN',
      riskScore: 0.5,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    handleError(error);
    throw error;
  }
};
