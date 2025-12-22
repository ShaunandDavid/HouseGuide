// Voice note AI categorization endpoint
import { Router } from "express";
import OpenAI from "openai";
import { z } from "zod";
// requireAuth middleware - will be added when integrating with main routes

const router = Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const readEnvNumber = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const MIN_SEGMENT_CONFIDENCE = Math.min(1, Math.max(0, readEnvNumber("MIN_SEGMENT_CONFIDENCE", 0.6)));

// PII Redaction for HIPAA compliance
const REDACTION_REGEXES: Array<[RegExp, string]> = [
  [/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]"],
  [/\b\d{1,5}\s+[A-Za-z0-9.\-]+\s+(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr)\b/gi, "[ADDRESS]"],
  [/\b(Sponsor|Therapist|Doctor|Case\s*Manager)\s*:\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g, "[REDACTED_NAME]"],
];

function redactPII(text: string): string {
  let out = text;
  for (const [rx, repl] of REDACTION_REGEXES) out = out.replace(rx, repl);
  return out;
}

// AI Response Schema
const CategorizedSegment = z.object({
  text: z.string(),
  category: z.enum(["work_school", "demeanor", "sponsor", "medical", "chores", "general"]),
  confidence: z.number().min(0).max(1),
  reason: z.string()
});

const CategorizationResponse = z.object({
  segments: z.array(CategorizedSegment),
  summary: z.string()
});

// Voice note categorization endpoint
router.post("/categorize-voice", async (req: any, res) => {
  try {
    const { transcript, residentId } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: "Transcript is required" });
    }

    if (!residentId) {
      return res.status(400).json({ error: "Resident ID is required" });
    }

    // Redact PII for HIPAA compliance
    const redactedTranscript = redactPII(transcript);

    // AI Categorization Prompt
    const systemPrompt = `You are a professional case management assistant for sober living facilities. Your job is to analyze comprehensive voice notes about residents and categorize the content into specific recovery areas.

CATEGORIES (use these exact values):
- "work_school": Employment, job searches, interviews, workplace issues, education, classes, GED, college
- "demeanor": Attitude, behavior, participation in groups, social interactions, mood, cooperation
- "sponsor": AA/NA meetings, sponsor relationships, step work, recovery program participation
- "medical": Doctor appointments, therapy, medication compliance, mental health, physical health
- "chores": House responsibilities, cleaning, compliance with rules, curfew, assignments

INSTRUCTIONS:
1. Break down the voice note into meaningful segments
2. Assign each segment to the most appropriate category
3. Provide confidence scores (0-1) and brief reasoning
4. Focus on actionable, specific content rather than vague statements
5. Ensure segments are substantial enough to be meaningful in reports

Return valid JSON only.`;

    const userPrompt = `Analyze this comprehensive voice note about a resident and categorize the content:

"${redactedTranscript}"

Break this down into categorized segments that will be useful for weekly reports and case management.`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    const responseText = completion.choices[0].message.content;
    if (!responseText) {
      throw new Error("Empty response from AI");
    }

    // Parse and validate AI response
    const aiResponse = JSON.parse(responseText);
    const validatedResponse = CategorizationResponse.parse(aiResponse);
    const normalizedSegments = validatedResponse.segments.map(segment => {
      if (segment.confidence < MIN_SEGMENT_CONFIDENCE) {
        return {
          ...segment,
          category: "general",
          reason: "Low confidence; saved as General."
        };
      }
      return segment;
    });

    // Prepare response
    const result = {
      segments: normalizedSegments,
      fullTranscript: transcript, // Original transcript for display
      summary: validatedResponse.summary
    };

    res.json(result);
  } catch (error) {
    console.error('Voice note categorization error:', error);
    
    // Fallback to keyword-based categorization
    try {
      const fallbackResult = fallbackCategorization(req.body.transcript);
      res.json(fallbackResult);
    } catch (fallbackError) {
      res.status(500).json({ error: "Failed to categorize voice note" });
    }
  }
});

// Keyword-based fallback categorization
function fallbackCategorization(transcript: string) {
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  const categoryKeywords = {
    work_school: /\b(job|work|shift|hire|resume|interview|clocked|school|class|credits|ged|college|study|employment|workplace)\b/i,
    demeanor: /\b(attitude|behavior|mood|positive|negative|group|participate|cooperative|social|interaction|engagement)\b/i,
    sponsor: /\b(aa|na|sponsor|mentor|meeting|12[-\s]?step|home\s*group|recovery|program|spiritual)\b/i,
    medical: /\b(doctor|therapy|therapist|medication|appointment|mental|health|medical|treatment|counseling)\b/i,
    chores: /\b(chore|dish|trash|laundry|clean|inspection|curfew|compliance|rule|assignment|duty|responsibility)\b/i
  };

  const segments = sentences.map(sentence => {
    let bestCategory: keyof typeof categoryKeywords = 'demeanor'; // default
    let maxMatches = 0;

    for (const [category, regex] of Object.entries(categoryKeywords)) {
      const matches = (sentence.match(regex) || []).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestCategory = category as keyof typeof categoryKeywords;
      }
    }

    return {
      text: sentence.trim(),
      category: bestCategory,
      confidence: maxMatches > 0 ? 0.7 : 0.3,
      reason: maxMatches > 0 ? "Keyword-based classification" : "Default classification"
    };
  }).filter(segment => segment.text.length > 10);

  const normalizedSegments = segments.map(segment => {
    if (segment.confidence < MIN_SEGMENT_CONFIDENCE) {
      return {
        ...segment,
        category: "general",
        reason: "Low confidence; saved as General."
      };
    }
    return segment;
  });

  return {
    segments: normalizedSegments,
    fullTranscript: transcript,
    summary: "Voice note categorized using keyword fallback system"
  };
}

export { router as notesCategorization };
