// server/ai/generateWeeklyReport.ts
import OpenAI from "openai";
import { z } from "zod";

/**
 * HouseGuide Semantic Report Orchestrator
 * - Classifies entries into 5 sections via LLM JSON schema
 * - HIPAA-forward: redacts obvious PII before model call
 * - Deterministic fallback (rules) if LLM unavailable
 * - Returns polished Markdown report + structured JSON
 *
 * INPUT SHAPE expected by orchestrator (already matches your data fetch):
 * type Entry = {
 *   id: string;
 *   type: "goal"|"chore"|"meeting"|"incident"|"note";
 *   text: string;              // human text (goal/incident/note/etc.)
 *   createdAt: string;         // ISO
 *   tags?: string[];           // optional
 * };
 */

export type Entry = {
  id: string;
  type: "goal" | "chore" | "meeting" | "incident" | "note";
  text: string;
  createdAt: string;
  tags?: string[];
  category?: "work_school" | "demeanor" | "sponsor" | "medical" | "chores" | "general";
};

const MODEL = process.env.OPENAI_MODEL ?? "gpt-3.5-turbo"; // use "gpt-5" if enabled in your env
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** ---------------- HIPAA-Forward utilities ---------------- **/

const REDACTION_REGEXES: Array<[RegExp, string]> = [
  // phones, emails, addresses (basic), names after labels
  [/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]"],
  [/\b\d{1,5}\s+[A-Za-z0-9.\-]+\s+(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr)\b/gi, "[ADDRESS]"],
  // label-based name captures (basic)
  [/\b(Sponsor|Therapist|Doctor|Case\s*Manager)\s*:\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g, "[REDACTED_NAME]"],
];

function redactPII(text: string): string {
  let out = text;
  for (const [rx, repl] of REDACTION_REGEXES) out = out.replace(rx, repl);
  return out;
}

function redactEntries(entries: Entry[]): Entry[] {
  return entries.map((e) => ({ ...e, text: redactPII(e.text) }));
}

/** ---------------- Section taxonomy ---------------- **/

const SectionId = z.enum([
  "SponsorMentor",
  "WorkSchool",
  "ChoresCompliance",
  "DemeanorParticipation",
  "ProfessionalHelpAppointments",
]);

const ClassifiedItem = z.object({
  id: z.string(),
  sourceType: z.enum(["goal", "chore", "meeting", "incident", "note"]),
  text: z.string(),
  reason: z.string(), // brief why it belongs here
  confidence: z.number().min(0).max(1),
  date: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const SectionBucket = z.object({
  items: z.array(ClassifiedItem),
  summary: z.string(), // concise narrative for the section
});

const ClassificationSchema = z.object({
  sections: z.object({
    SponsorMentor: SectionBucket,
    WorkSchool: SectionBucket,
    ChoresCompliance: SectionBucket,
    DemeanorParticipation: SectionBucket,
    ProfessionalHelpAppointments: SectionBucket,
  }),
  uncategorized: z.array(z.string()), // entry ids we couldn't confidently place
  overallSummary: z.string(),
});

export type Classification = z.infer<typeof ClassificationSchema>;

/** ---------------- Deterministic keyword fallback (last resort) ---------------- **/

const RULES: Record<z.infer<typeof SectionId>, RegExp[]> = {
  SponsorMentor: [
    /\b(aa|na|sponsor|mentor|meeting|12[-\s]?step|home\s*group)\b/i,
  ],
  WorkSchool: [
    /\b(job|work|shift|hire|resume|interview|clocked|school|class|credits|ged|college|study)\b/i,
  ],
  ChoresCompliance: [
    /\b(chore|dish|trash|laundry|clean|inspection|curfew|compliance|rule|assignment|duty)\b/i,
  ],
  DemeanorParticipation: [
    /\b(mood|agitated|anxious|argument|conflict|helpful|engaged|participation|demeanor|behavior|supportive)\b/i,
  ],
  ProfessionalHelpAppointments: [
    /\b(therap(y|ist)|counsel|doctor|psychiatr|medication|clinic|appointment|checkup|treatment|group\s*therapy)\b/i,
  ],
};

function ruleRoute(entry: Entry): z.infer<typeof SectionId> | null {
  for (const [section, tests] of Object.entries(RULES) as [z.infer<typeof SectionId>, RegExp[]][]) {
    if (tests.some((rx) => rx.test(entry.text))) return section;
  }
  return null;
}

/** ---------------- LLM classification ---------------- **/

async function classifyWithLLM(entries: Entry[]): Promise<Classification> {
  const schema = {
    name: "HouseGuideClassification",
    schema: ClassificationSchema,
    strict: true,
  };

  const system = [
    "You are HouseGuide's clinical report classifier.",
    "Classify each entry into EXACTLY one of these sections:",
    "1) SponsorMentor, 2) WorkSchool, 3) ChoresCompliance, 4) DemeanorParticipation, 5) ProfessionalHelpAppointments.",
    "Use SEMANTIC meaning, not keywords.",
    "If unsure, leave it out and include its id in uncategorized.",
    "Summaries must read like professional residential care notes.",
    "Keep PHI minimal (respect redactions already present).",
  ].join(" ");

  const examples = [
    {
      id: "ex1",
      type: "goal",
      text: "Attend AA meetings daily and check in with sponsor every evening.",
      expected: "SponsorMentor",
    },
    {
      id: "ex2",
      type: "note",
      text: "Resident reported therapy appointment completed today; next session next Friday.",
      expected: "ProfessionalHelpAppointments",
    },
    {
      id: "ex3",
      type: "incident",
      text: "Seemed agitated during dinner, raised voice at a peer, later apologized.",
      expected: "DemeanorParticipation",
    },
    {
      id: "ex4",
      type: "chore",
      text: "Completed kitchen duties, passed room inspection; curfew met.",
      expected: "ChoresCompliance",
    },
    {
      id: "ex5",
      type: "note",
      text: "Dropped off applications and interviewed at a warehouse.",
      expected: "WorkSchool",
    },
    {
      id: "ex6",
      type: "note",
      text: "Works at Target",
      expected: "WorkSchool",
    },
    {
      id: "ex7",
      type: "note",
      text: "Self reported job at CIPA USA",
      expected: "WorkSchool",
    },
    {
      id: "ex8",
      type: "note",
      text: "Working on finding a job",
      expected: "WorkSchool",
    },
    {
      id: "ex9",
      type: "note",
      text: "Works 30 hours at Culvers; picked up an extra shift this week.",
      expected: "WorkSchool",
    },
    {
      id: "ex10",
      type: "incident",
      text: "Got frustrated about work schedule conflicts with house meetings",
      expected: "DemeanorParticipation",
    },
  ];

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: system,
      },
      {
        role: "user",
        content: [
          "Here are examples of correct categorization (for context only):",
          JSON.stringify(examples, null, 2),
          "Now classify the following entries. Respond ONLY with JSON matching the schema with sections object containing SponsorMentor, WorkSchool, ChoresCompliance, DemeanorParticipation, ProfessionalHelpAppointments (each with items array and summary string), uncategorized array, and overallSummary string.",
          JSON.stringify(entries, null, 2),
        ].join("\n"),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content || "";
  const parsed = ClassificationSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("LLM returned invalid JSON classification");
  }
  return parsed.data;
}

/** ---------------- Category-Based Routing ---------------- **/

function routeByExplicitCategory(entry: Entry): z.infer<typeof SectionId> | null {
  // Map explicit user categories to report sections
  switch(entry.category) {
    case "work_school": return "WorkSchool";
    case "demeanor": return "DemeanorParticipation";
    case "sponsor": return "SponsorMentor";
    case "medical": return "ProfessionalHelpAppointments";
    case "chores": return "ChoresCompliance";
    default: return null;
  }
}

/** ---------------- Employment Corrector ---------------- **/

function isEmploymentContent(text: string): boolean {
  // Strong employment indicators
  const employmentPatterns = /\b(works?\s+at|employed\s+at|job\s+at|position\s+at|hired\s+at|self[\s-]?reported\s+job|finding\s+a?\s+job|looking\s+for\s+(work|job|employment)|applied\s+for|interview\s+at|shift\s+at|clocked\s+in|resume|w[-\s]?2|paycheck)\b/i;
  
  // Company names that are definitely employment
  const companyNames = /\b(target|culver'?s|cipa\s*usa|walmart|amazon|mcdonald'?s|starbucks|home\s*depot)\b/i;
  
  return employmentPatterns.test(text) || companyNames.test(text);
}

function isEmotionalContext(text: string): boolean {
  // Check if primary context is emotional/behavioral
  const emotionalPatterns = /\b(angry|frustrated|upset|argued|conflict|anxious|agitated|depressed|happy|excited|stressed|overwhelmed|nervous|calm|aggressive|withdrawn)\s+(about|regarding|with|over|due\s+to)?\s*(work|job|employment)?/i;
  return emotionalPatterns.test(text);
}

function correctEmploymentLeak(c: Classification): Classification {
  const moved: typeof c.sections.WorkSchool.items = [];
  let correctionsMade = 0;

  // Scan Demeanor for misfiled employment notes
  c.sections.DemeanorParticipation.items = c.sections.DemeanorParticipation.items.filter((it) => {
    // If it's clearly employment content AND not primarily emotional
    if (isEmploymentContent(it.text) && !isEmotionalContext(it.text)) {
      // Only move if confidence is less than 0.9 (not super confident)
      if (it.confidence < 0.9) {
        moved.push({ 
          ...it, 
          reason: `Employment content corrected from Demeanor to Work/School`, 
          confidence: Math.max(it.confidence, 0.85) 
        });
        correctionsMade++;
        console.log(`[CORRECTOR] Moving to Work/School: "${it.text}"`);
        return false; // remove from Demeanor
      }
    }
    return true; // keep in Demeanor
  });

  // Also check other sections for misplaced employment content
  const sectionsToCheck = ['SponsorMentor', 'ChoresCompliance', 'ProfessionalHelpAppointments'] as const;
  
  for (const sectionName of sectionsToCheck) {
    c.sections[sectionName].items = c.sections[sectionName].items.filter((it) => {
      if (isEmploymentContent(it.text) && !isEmotionalContext(it.text) && it.confidence < 0.85) {
        moved.push({ 
          ...it, 
          reason: `Employment content corrected from ${sectionName} to Work/School`, 
          confidence: Math.max(it.confidence, 0.85) 
        });
        correctionsMade++;
        console.log(`[CORRECTOR] Moving from ${sectionName} to Work/School: "${it.text}"`);
        return false;
      }
      return true;
    });
  }

  // Add moved items to Work/School
  c.sections.WorkSchool.items.push(...moved);
  
  if (moved.length) {
    c.sections.WorkSchool.summary = c.sections.WorkSchool.summary 
      ? `${c.sections.WorkSchool.summary} (${moved.length} employment items corrected from other sections)`
      : `Employment activity recorded. ${moved.length} employment-related item(s) identified.`;
  }

  console.log(`[CORRECTOR] Total corrections made: ${correctionsMade}`);
  
  return c;
}

/** ---------------- Public Orchestrator ---------------- **/

export async function generateWeeklyReport(
  residentId: string,
  weekIsoRange: { start: string; end: string },
  entries: Entry[],
) {
  console.info("[REPORT] Starting weekly report generation");
  console.info("[REPORT] Model:", process.env.OPENAI_MODEL ?? "gpt-3.5-turbo");
  console.info("[REPORT] Total entries:", entries.length);
  
  const sanitized = redactEntries(entries);

  // First, try to classify using explicit categories
  const buckets: Record<z.infer<typeof SectionId>, z.infer<typeof SectionBucket>["items"]> = {
    SponsorMentor: [],
    WorkSchool: [],
    ChoresCompliance: [],
    DemeanorParticipation: [],
    ProfessionalHelpAppointments: [],
  };
  const uncategorized: string[] = [];
  
  // Route entries by explicit category first
  for (const e of sanitized) {
    const explicitRoute = routeByExplicitCategory(e);
    if (explicitRoute) {
      buckets[explicitRoute].push({
        id: e.id,
        sourceType: e.type,
        text: e.text,
        reason: "User-selected category",
        confidence: 1.0, // 100% confidence for user selections
        date: e.createdAt,
        tags: e.tags,
      });
    } else {
      uncategorized.push(e.id); // Will be processed by AI later
    }
  }
  
  // Try LLM for uncategorized entries
  let llmUsed = false;
  
  if (uncategorized.length > 0) {
    const uncategorizedEntries = sanitized.filter(e => uncategorized.includes(e.id));
    
    try {
      const llmClassification = await classifyWithLLM(uncategorizedEntries);
      llmUsed = true;
      console.info("[REPORT] LLM classification successful for uncategorized entries");
      
      // Merge LLM results with explicit category results
      for (const section of Object.keys(llmClassification.sections) as z.infer<typeof SectionId>[]) {
        buckets[section].push(...llmClassification.sections[section].items);
      }
      // Clear uncategorized since LLM processed them
      uncategorized.length = 0;
      uncategorized.push(...llmClassification.uncategorized);
    } catch (e) {
      console.warn("[REPORT] LLM classification failed, using rule-based fallback:", e);
      // Fallback to deterministic rules for uncategorized entries
      
      const stillUncategorized: string[] = [];
      for (const eId of uncategorized) {
        const e = sanitized.find(entry => entry.id === eId);
        if (!e) continue;
        
        const where = ruleRoute(e);
        if (where) {
          buckets[where].push({
            id: e.id,
            sourceType: e.type,
            text: e.text,
            reason: "Rule-based fallback",
            confidence: 0.55,
            date: e.createdAt,
            tags: e.tags,
          });
        } else {
          stillUncategorized.push(e.id);
        }
      }
      uncategorized.length = 0;
      uncategorized.push(...stillUncategorized);
    }
  } else {
    console.info("[REPORT] All entries have user-selected categories, skipping AI classification");
  }
  
  // Create final classification from buckets
  const summarize = (items: typeof buckets.SponsorMentor) => {
    if (!items.length) return "No updates recorded in this category for the period.";
    const count = items.length;
    const typeSet = new Set(items.map((i) => i.sourceType));
    const types = Array.from(typeSet).join(", ");
    return `Recorded ${count} item(s) (${types}). Key notes reflect typical activity and compliance for this week.`;
  };

  let classification: Classification = {
    sections: {
      SponsorMentor: { items: buckets.SponsorMentor, summary: summarize(buckets.SponsorMentor) },
      WorkSchool: { items: buckets.WorkSchool, summary: summarize(buckets.WorkSchool) },
      ChoresCompliance: { items: buckets.ChoresCompliance, summary: summarize(buckets.ChoresCompliance) },
      DemeanorParticipation: { items: buckets.DemeanorParticipation, summary: summarize(buckets.DemeanorParticipation) },
      ProfessionalHelpAppointments: { items: buckets.ProfessionalHelpAppointments, summary: summarize(buckets.ProfessionalHelpAppointments) },
    },
    uncategorized,
    overallSummary: llmUsed 
      ? "Report generated with user categories and AI classification assistance."
      : uncategorized.length > 0 
        ? "Report generated with user categories and rule-based classification."
        : "Report generated from user-categorized entries.",
  };

  // Apply employment corrector to fix any miscategorized work content
  classification = correctEmploymentLeak(classification);
  
  // Log final distribution
  console.info("[REPORT] Final categorization counts:", {
    sponsor: classification.sections.SponsorMentor.items.length,
    work: classification.sections.WorkSchool.items.length,
    chores: classification.sections.ChoresCompliance.items.length,
    demeanor: classification.sections.DemeanorParticipation.items.length,
    professional: classification.sections.ProfessionalHelpAppointments.items.length,
    uncategorized: classification.uncategorized.length,
    llmUsed: llmUsed
  });

  // Compose a clean, court/insurer-friendly Markdown
  const md = buildMarkdownReport(weekIsoRange, classification);

  return {
    residentId,
    week: weekIsoRange,
    classification,
    markdown: md,
  };
}

/** ---------------- Markdown composer ---------------- **/

function sec(title: string, s: z.infer<typeof SectionBucket>) {
  const bullets =
    s.items.length === 0
      ? "- No updates this week."
      : s.items.map((i) => `- (${i.sourceType}) ${trimSentence(i.text)} *(conf: ${i.confidence.toFixed(2)})*`).join("\n");
  return `### ${title}\n${s.summary}\n\n${bullets}\n`;
}

function trimSentence(t: string, max = 240) {
  const cleaned = t.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}

function buildMarkdownReport(
  range: { start: string; end: string },
  c: Classification,
) {
  return [
    `# Weekly Resident Report`,
    `**Period:** ${range.start} → ${range.end}`,
    ``,
    `## Summary`,
    c.overallSummary,
    ``,
    sec("Sponsor / Mentor", c.sections.SponsorMentor),
    sec("Work / School", c.sections.WorkSchool),
    sec("Chores / Compliance", c.sections.ChoresCompliance),
    sec("Demeanor / Participation", c.sections.DemeanorParticipation),
    sec("Professional Help / Appointments", c.sections.ProfessionalHelpAppointments),
    ``,
    c.uncategorized.length
      ? `> Uncategorized entries (review recommended): ${c.uncategorized.join(", ")}`
      : `> All entries categorized.`,
  ].join("\n");
}