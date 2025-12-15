
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, AnalysisStatus, TeacherReview, ChairDecision } from "../types";
import { STUDENT_INSTRUCTION, TEACHER_STYLE_INSTRUCTION, TEACHER_LAYOUT_INSTRUCTION, TEACHER_DATA_INSTRUCTION, CHAIR_QA_INSTRUCTION, CHAIR_STRATEGY_INSTRUCTION, STUDENT_REVISION_INSTRUCTION, REVIEWER_LITE_INSTRUCTION } from "./prompts";

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
  onStatusUpdate?: (status: any) => void
): Promise<AnalysisResult> => {
  const finalApiKey = customApiKey?.trim() || process.env.API_KEY;

  if (!finalApiKey) {
    throw new Error("API Key is missing. Please enter a custom key in the settings menu.");
  }

  const client = new GoogleGenAI({ apiKey: finalApiKey });

  try {
    if (onStatusUpdate) onStatusUpdate('ANALYZING'); 
    
    console.log("Phase 1: Student Agent (Coder) Starting...");
    const studentResponse = await client.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Image } },
          { text: "Analyze this scientific figure. First, provide a detailed VISUAL ANALYSIS (Axes, Data, Layout). Then, EXTRACT all data into the JSON schema and finally WRITE THE PYTHON CODE to replicate it." },
        ],
      },
      config: {
        systemInstruction: STUDENT_INSTRUCTION,
        temperature: 0.2, 
      },
    });

    const studentOutput = studentResponse.text;
    if (!studentOutput) throw new Error("Student Agent returned empty response.");

    // RETURN EARLY - Let the App render this code first!
    return {
      markdown: studentOutput,
      timestamp: Date.now(),
    };

  } catch (error: any) {
    console.error("Gemini API Error details:", error);
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
  onStatusUpdate?: (status: any) => void,
  options?: { preset?: 'lite' | 'full' }
): Promise<AnalysisResult> => {
  const finalApiKey = customApiKey?.trim() || process.env.API_KEY;
  if (!finalApiKey) throw new Error("API Key is missing.");

  const client = new GoogleGenAI({ apiKey: finalApiKey });

  try {
    const preset = options?.preset ?? 'full';

    const buildCompareParts = () => {
      const parts: any[] = [];
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
      if (onStatusUpdate) onStatusUpdate(AnalysisStatus.CHAIR_QA);
      const liteResponse = await client.models.generateContent({
        model: modelName,
        contents: { parts: buildCompareParts() },
        config: { systemInstruction: REVIEWER_LITE_INSTRUCTION, temperature: 0.1 }
      });

      const liteSummary = liteResponse.text || '';
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

      if (onStatusUpdate) onStatusUpdate(AnalysisStatus.REFINING);
      const studentParts = [
        { text: `CURRENT PYTHON CODE:\n\`\`\`python\n${currentPythonCode}\n\`\`\`` },
        { text: `LITE REVIEWER SUMMARY:\n${liteSummary}` },
        studentBrief ? { text: `STUDENT BRIEF:\n${studentBrief}` } : null,
      ].filter(Boolean) as any[];

      const studentRevisionResponse = await client.models.generateContent({
        model: modelName,
        contents: { parts: studentParts },
        config: {
          systemInstruction: STUDENT_REVISION_INSTRUCTION,
          temperature: 0.05
        }
      });

      if (!studentRevisionResponse.text) throw new Error("Student Coder returned an empty response.");

      return {
        markdown: studentRevisionResponse.text,
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

    const buildTeacherPromptParts = () => {
      const parts: any[] = [];
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
      if (onStatusUpdate) onStatusUpdate(agent.status);
      const response = await client.models.generateContent({
        model: modelName,
        contents: { parts: buildTeacherPromptParts() },
        config: {
          systemInstruction: agent.instruction,
          temperature: 0.1,
        }
      });
      teacherReviews.push({
        role: agent.role,
        findings: response.text || ''
      });
    }

    // ========================================================================
    // CHAIR QA SYNTHESIS
    // ========================================================================
    if (onStatusUpdate) onStatusUpdate(AnalysisStatus.CHAIR_QA);
    const teacherJson = JSON.stringify(teacherReviews, null, 2);
    const qaParts = [
      { text: `TEACHER REVIEWS:\n${teacherJson}` },
      { text: `CURRENT PYTHON CODE:\n\`\`\`python\n${currentPythonCode}\n\`\`\`` }
    ];

    const qaResponse = await client.models.generateContent({
      model: modelName,
      contents: { parts: qaParts },
      config: {
        systemInstruction: CHAIR_QA_INSTRUCTION,
        temperature: 0.1,
      }
    });

    const qaSummary = qaResponse.text || '';
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

    // ========================================================================
    // CHAIR STRATEGY (Brief for Student)
    // ========================================================================
    if (onStatusUpdate) onStatusUpdate(AnalysisStatus.CHAIR_STRATEGY);
    const strategyParts = [
      { text: `TEACHER REVIEWS:\n${teacherJson}` },
      { text: `QA SUMMARY:\n${qaSummary}` }
    ];

    const strategyResponse = await client.models.generateContent({
      model: modelName,
      contents: { parts: strategyParts },
      config: {
        systemInstruction: CHAIR_STRATEGY_INSTRUCTION,
        temperature: 0.1,
      }
    });

    const strategySummary = strategyResponse.text || '';
    const strategyJson = extractJsonFromText(strategySummary);
    const strategyActions = Array.isArray(strategyJson?.action_items)
      ? strategyJson.action_items.map((item: any) => {
          if (typeof item === 'string') return item;
          if (item?.detail) return item.detail;
          return JSON.stringify(item);
        })
      : undefined;
    chairFindings.push({ role: 'STRATEGY', summary: strategySummary, priorityFixes: strategyActions });

    // ========================================================================
    // STUDENT REVISION (Code Fixes)
    // ========================================================================
    if (onStatusUpdate) onStatusUpdate(AnalysisStatus.REFINING);
    const studentParts = [
      { text: `CURRENT PYTHON CODE:\n\`\`\`python\n${currentPythonCode}\n\`\`\`` },
      { text: `TEACHER REVIEWS:\n${teacherJson}` },
      { text: `QA SUMMARY:\n${qaSummary}` },
      { text: `CHAIR STRATEGY BRIEF:\n${strategySummary}` }
    ];

    const studentRevisionResponse = await client.models.generateContent({
      model: modelName,
      contents: { parts: studentParts },
      config: {
        systemInstruction: STUDENT_REVISION_INSTRUCTION,
        temperature: 0.05
      }
    });

    if (!studentRevisionResponse.text) throw new Error("Student Coder returned an empty response.");

    return {
      markdown: studentRevisionResponse.text,
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
