import OpenAI from 'openai';
import type { AIProvider, WeeklyReportData } from '../index';
import { generateWeeklyReport as semanticGenerateWeeklyReport, type Entry } from '../generateWeeklyReport';

export class OpenAIProvider implements AIProvider {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.openai && !!process.env.OPENAI_API_KEY;
  }

  async generateWeeklyReport(data: WeeklyReportData, template: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI not configured - missing OPENAI_API_KEY');
    }

    // Convert data to Entry format for semantic classification
    const entries: Entry[] = [];
    const checklist = data.data.checklist;
    const checklistTimestamp = this.getRecordTimestamp(checklist) || new Date().toISOString();
    
    // Add goals
    data.data.goals.forEach(goal => {
      entries.push({
        id: goal.id,
        type: 'goal',
        text: `${goal.title}: ${goal.description || ''}`.trim(),
        createdAt: this.getRecordTimestamp(goal) || new Date().toISOString(),
        tags: [goal.status, goal.priority].filter(Boolean)
      });
    });
    
    // Add chores
    data.data.chores.forEach(chore => {
      entries.push({
        id: chore.id,
        type: 'chore',
        text: `${chore.choreName}: ${chore.notes || ''}`.trim(),
        createdAt: this.getRecordTimestamp(chore) || new Date().toISOString(),
        tags: [chore.status].filter(Boolean)
      });
    });
    
    // Add meetings
    data.data.meetings.forEach(meeting => {
      entries.push({
        id: meeting.id,
        type: 'meeting',
        text: `${meeting.meetingType}: ${meeting.notes || ''}`.trim(),
        createdAt: this.getRecordTimestamp(meeting) || new Date().toISOString(),
        tags: [meeting.meetingType].filter(Boolean)
      });
    });
    
    // Add incidents
    data.data.incidents.forEach(incident => {
      entries.push({
        id: incident.id,
        type: 'incident',
        text: `${incident.incidentType} (${incident.severity}): ${incident.description}`,
        createdAt: this.getRecordTimestamp(incident) || new Date().toISOString(),
        tags: [incident.incidentType, incident.severity].filter(Boolean)
      });
    });
    
    // Add notes
    data.data.notes.forEach(note => {
      entries.push({
        id: note.id,
        type: 'note',
        text: note.text,
        createdAt: this.getRecordTimestamp(note) || new Date().toISOString(),
        tags: [note.source].filter(Boolean),
        category: note.category // Pass through the user-selected category
      });
    });
    
    // Add accomplishments
    data.data.accomplishments.forEach(accomplishment => {
      entries.push({
        id: accomplishment.id,
        type: 'note', // Map to note type for classification
        text: `Accomplishment - ${accomplishment.title}: ${accomplishment.description || ''}`.trim(),
        createdAt: this.getRecordTimestamp(accomplishment) || new Date().toISOString(),
        tags: [accomplishment.category].filter(Boolean)
      });
    });

    // Add checklist context for report routing
    if (checklist) {
      if (checklist.sponsorMentor) {
        entries.push({
          id: `checklist-sponsor-${data.resident.id}`,
          type: 'note',
          text: `Sponsor/Mentor: ${checklist.sponsorMentor}`,
          createdAt: checklistTimestamp,
          tags: ['checklist'],
          category: 'sponsor'
        });
      }
      if (checklist.homeGroup) {
        entries.push({
          id: `checklist-homegroup-${data.resident.id}`,
          type: 'note',
          text: `Home group: ${checklist.homeGroup}`,
          createdAt: checklistTimestamp,
          tags: ['checklist'],
          category: 'sponsor'
        });
      }
      if (checklist.stepWork) {
        entries.push({
          id: `checklist-stepwork-${data.resident.id}`,
          type: 'note',
          text: `Step work: ${checklist.stepWork}`,
          createdAt: checklistTimestamp,
          tags: ['checklist'],
          category: 'sponsor'
        });
      }
      if (checklist.job) {
        entries.push({
          id: `checklist-employment-${data.resident.id}`,
          type: 'note',
          text: `Employment: ${checklist.job}`,
          createdAt: checklistTimestamp,
          tags: ['checklist'],
          category: 'work_school'
        });
      }
      if (checklist.program) {
        entries.push({
          id: `checklist-program-${data.resident.id}`,
          type: 'note',
          text: `Program: ${checklist.program}`,
          createdAt: checklistTimestamp,
          tags: ['checklist'],
          category: 'medical'
        });
      }
      if (checklist.professionalHelp) {
        entries.push({
          id: `checklist-professional-${data.resident.id}`,
          type: 'note',
          text: `Professional help: ${checklist.professionalHelp}`,
          createdAt: checklistTimestamp,
          tags: ['checklist'],
          category: 'medical'
        });
      }
    }
    
    let categorizedContext = '';
    try {
      const result = await semanticGenerateWeeklyReport(
        data.resident.id,
        {
          start: data.period.weekStart,
          end: data.period.weekEnd
        },
        entries
      );
      categorizedContext = this.formatClassificationForPrompt(result.classification);
    } catch (semanticError) {
      console.log('Semantic classification failed, continuing without categorized context:', semanticError);
    }

    const overview = this.buildOverview(data);

    const systemPrompt = [
      "You are writing a weekly resident report in the voice of an experienced sober living house guide.",
      "The report is read by facility owners, probation officers, MARR officials, and judges.",
      "Write conversationally, like you're texting your supervisor. Keep it real, honest, and direct.",
      "Use the exact template headers and order.",
      "Write short paragraphs (1-3 sentences) per section; no bullet lists.",
      "Be factual and use only the data provided. Do not invent details.",
      "When entries conflict, prefer the most recent timestamp.",
      "If a section has no data, write: No updates this week (use 'No additional observations this week' for House Guide Observations).",
      "Include concerns and follow-ups naturally when present.",
      "Include personal observations in the House Guide Observations section.",
      "Use first name and last initial only."
    ].join(" ");

    const categorizedBlock = categorizedContext
      ? `
CATEGORIZED NOTES BY SECTION:
${categorizedContext}
`
      : "";

    const rulesBlockParts: string[] = [];
    if (data.organization?.defaultRules) {
      rulesBlockParts.push(`ORGANIZATION RULES:\n${data.organization.defaultRules}`);
    }
    if (data.house.rules) {
      rulesBlockParts.push(`HOUSE RULES:\n${data.house.rules}`);
    }
    const rulesBlock = rulesBlockParts.length
      ? `\n${rulesBlockParts.join("\n\n")}\n`
      : "";

    const userPrompt = `Write the weekly report for ${data.resident.firstName} ${data.resident.lastInitial} for the week of ${data.period.weekStart}.

TEMPLATE TO FOLLOW EXACTLY:
${template}

SUGGESTED OVERVIEW (from structured data):
${overview}
${categorizedBlock}${rulesBlock}RAW DATA:
${this.formatDataForPrompt(data)}

IMPORTANT:
- Replace {{residentName}} with "${data.resident.firstName} ${data.resident.lastInitial}."
- Replace {{weekStart}} with "${data.period.weekStart}"
- Replace {{overview}} with a concise weekly recap based on the data above
- Replace {{observations}} with candid house guide observations from general notes (or say "No additional observations this week")
- Fill each section based on the data provided
- Mention meetings, accomplishments, incidents, fees, goals, and notes in the most relevant sections
- Use "No updates this week" for sections without relevant data
- Maintain the exact format and structure and return only the report text`;
    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini", // Cost-effective modern model for report generation
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.4, // Slightly higher for conversational tone while staying grounded
        max_tokens: 2000,
      });

      const generatedReport = response.choices[0]?.message?.content;
      if (!generatedReport) {
        throw new Error('No response from OpenAI');
      }

      return generatedReport.trim();
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate report with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatDataForPrompt(data: WeeklyReportData): string {
    const sections = [];
    const checklist = data.data.checklist;
    const checklistTimestamp = this.getRecordTimestamp(checklist);

    // Checklist snapshot
    if (checklist) {
      sections.push('CHECKLIST SNAPSHOT:');
      if (checklistTimestamp) sections.push(`- Last updated: ${this.formatTimestamp(checklistTimestamp)}`);
      if (checklist.phase) sections.push(`- Phase: ${checklist.phase}`);
      if (checklist.program) sections.push(`- Program: ${checklist.program}`);
      if (checklist.sponsorMentor) sections.push(`- Sponsor/Mentor: ${checklist.sponsorMentor}`);
      if (checklist.homeGroup) sections.push(`- Home group: ${checklist.homeGroup}`);
      if (checklist.stepWork) sections.push(`- Step work: ${checklist.stepWork}`);
      if (checklist.professionalHelp) sections.push(`- Professional help: ${checklist.professionalHelp}`);
      if (checklist.job) sections.push(`- Employment: ${checklist.job}`);
      sections.push('');
    }

    // Goals
    if (data.data.goals.length > 0) {
      sections.push(`GOALS (${data.data.goals.length} total):`);
      data.data.goals.forEach(goal => {
        const meta = this.formatEntryMeta(goal, [{ field: 'targetDate', label: 'Target' }]);
        sections.push(`- ${goal.title} (${goal.status}) - ${goal.description || 'No description'}${meta}`);
      });
    } else {
      sections.push('GOALS: None recorded this week');
    }

    // Accomplishments
    if (data.data.accomplishments.length > 0) {
      sections.push(`\nACCOMPLISHMENTS (${data.data.accomplishments.length} total):`);
      data.data.accomplishments.forEach(acc => {
        const meta = this.formatEntryMeta(acc, [{ field: 'dateAchieved', label: 'Achieved' }]);
        sections.push(`- ${acc.title} (${acc.category}) - ${acc.description || 'No description'}${meta}`);
      });
    } else {
      sections.push('\nACCOMPLISHMENTS: None recorded this week');
    }

    // Chores
    if (data.data.chores.length > 0) {
      sections.push(`\nCHORES (${data.data.chores.length} total):`);
      data.data.chores.forEach(chore => {
        const meta = this.formatEntryMeta(chore, [
          { field: 'assignedDate', label: 'Assigned' },
          { field: 'dueDate', label: 'Due' }
        ]);
        sections.push(`- ${chore.choreName} (${chore.status})${meta}`);
      });
    } else {
      sections.push('\nCHORES: None assigned this week');
    }

    // Incidents
    if (data.data.incidents.length > 0) {
      sections.push(`\nINCIDENTS (${data.data.incidents.length} total):`);
      data.data.incidents.forEach(incident => {
        const meta = this.formatEntryMeta(incident, [{ field: 'dateOccurred', label: 'Date' }]);
        sections.push(`- ${incident.incidentType} (${incident.severity}) - ${incident.description}${meta}`);
      });
    } else {
      sections.push('\nINCIDENTS: None reported this week');
    }

    // Meetings
    if (data.data.meetings.length > 0) {
      sections.push(`\nMEETINGS (${data.data.meetings.length} total):`);
      data.data.meetings.forEach(meeting => {
        const meta = this.formatEntryMeta(meeting, [{ field: 'dateAttended', label: 'Date' }]);
        sections.push(`- ${meeting.meetingType} - ${meeting.notes || 'No notes'}${meta}`);
      });
    } else {
      sections.push('\nMEETINGS: None attended this week');
    }

    // Program Fees
    if (data.data.programFees.length > 0) {
      sections.push(`\nPROGRAM FEES (${data.data.programFees.length} total):`);
      data.data.programFees.forEach(fee => {
        const meta = this.formatEntryMeta(fee, [
          { field: 'dueDate', label: 'Due' },
          { field: 'paidDate', label: 'Paid' }
        ]);
        sections.push(`- $${fee.amount} ${fee.feeType} (${fee.status})${meta}`);
      });
    } else {
      sections.push('\nPROGRAM FEES: None this week');
    }

    // Notes
    if (data.data.notes.length > 0) {
      sections.push(`\nNOTES (${data.data.notes.length} total):`);
      data.data.notes.forEach(note => {
        const preview = note.text.length > 100 ? note.text.substring(0, 100) + '...' : note.text;
        const sourceLabel = note.source ? note.source.toUpperCase() : 'MANUAL';
        const categoryLabel = note.category && note.category !== 'general' ? ` (${note.category})` : '';
        const meta = this.formatEntryMeta(note);
        sections.push(`- [${sourceLabel}${categoryLabel}] ${preview}${meta}`);
      });
    } else {
      sections.push('\nNOTES: None recorded this week');
    }

    const observationNotes = data.data.notes.filter(note => !note.category || note.category === 'general');
    if (observationNotes.length > 0) {
      sections.push(`\nGENERAL NOTES (use for House Guide Observations):`);
      observationNotes.slice(0, 5).forEach(note => {
        const preview = note.text.length > 120 ? note.text.substring(0, 120) + '...' : note.text;
        const meta = this.formatEntryMeta(note);
        sections.push(`- ${preview}${meta}`);
      });
    }

    if (data.data.files && data.data.files.length > 0) {
      sections.push(`\nDOCUMENTS (${data.data.files.length} total):`);
      data.data.files.forEach((file: any) => {
        const meta = this.formatEntryMeta(file);
        sections.push(`- ${file.type || 'document'} - ${file.filename || 'Unnamed file'}${meta}`);
      });
    } else {
      sections.push('\nDOCUMENTS: None recorded this week');
    }

    return sections.join('\n');
  }

  private getRecordTimestamp(item?: any): string | undefined {
    if (!item) return undefined;
    return item.lastUpdated || item.updated || item.created;
  }

  private formatTimestamp(raw?: string): string {
    if (!raw) return 'unknown';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return String(raw);
    return parsed.toISOString();
  }

  private formatEntryMeta(item: any, fields: Array<{ field: string; label: string }> = []): string {
    if (!item) return '';
    const parts: string[] = [];

    fields.forEach(({ field, label }) => {
      if (item?.[field]) {
        parts.push(`${label}: ${item[field]}`);
      }
    });

    const recorded = this.getRecordTimestamp(item);
    if (recorded) {
      parts.push(`Recorded: ${this.formatTimestamp(recorded)}`);
    }

    return parts.length > 0 ? ` [${parts.join('; ')}]` : '';
  }

  private formatClassificationForPrompt(classification: any): string {
    if (!classification || !classification.sections) return '';

    const order = [
      { key: 'SponsorMentor', label: 'Sponsor/Mentor' },
      { key: 'WorkSchool', label: 'Work/School' },
      { key: 'ChoresCompliance', label: 'Chores/Compliance' },
      { key: 'DemeanorParticipation', label: 'Demeanor / Participation' },
      { key: 'ProfessionalHelpAppointments', label: 'Professional Help / Appointments' },
    ];

    const lines: string[] = [];
    order.forEach(({ key, label }) => {
      const items = classification.sections[key]?.items || [];
      if (items.length === 0) {
        lines.push(`${label}: (no categorized items)`);
        return;
      }
      lines.push(`${label}:`);
      items.slice(0, 8).forEach((item: any) => {
        const dateTag = item.date ? ` (${item.date})` : '';
        lines.push(`- ${this.truncate(item.text, 160)}${dateTag}`);
      });
    });

    if (classification.uncategorized?.length) {
      lines.push(`Uncategorized entry IDs: ${classification.uncategorized.join(', ')}`);
    }

    return lines.join('\n');
  }

  private buildOverview(data: WeeklyReportData): string {
    const checklist = data.data.checklist || {};
    const parts: string[] = [];
    const statusParts: string[] = [];

    if (checklist.phase) statusParts.push(`Phase: ${checklist.phase}`);
    if (checklist.program) statusParts.push(`Program: ${checklist.program}`);
    if (checklist.sponsorMentor) statusParts.push(`Sponsor/Mentor: ${checklist.sponsorMentor}`);
    if (checklist.homeGroup) statusParts.push(`Home group: ${checklist.homeGroup}`);
    if (checklist.job) statusParts.push(`Employment: ${checklist.job}`);
    if (checklist.professionalHelp) statusParts.push(`Professional help: ${this.truncate(checklist.professionalHelp, 120)}`);
    if (checklist.stepWork) statusParts.push(`Step work: ${this.truncate(checklist.stepWork, 120)}`);

    if (statusParts.length > 0) {
      parts.push(`${statusParts.join('. ')}.`);
    }

    const activityParts: string[] = [];
    if (data.data.meetings.length > 0) activityParts.push(`Meetings attended: ${data.data.meetings.length}`);
    if (data.data.accomplishments.length > 0) activityParts.push(`Accomplishments: ${data.data.accomplishments.length}`);
    const outstandingFees = data.data.programFees.filter(fee => fee.status !== 'paid');
    if (outstandingFees.length > 0) {
      activityParts.push(`Outstanding fees: ${outstandingFees.length}`);
    }
    if (data.data.incidents.length > 0) {
      activityParts.push(`Incidents: ${data.data.incidents.length}`);
    } else {
      activityParts.push('No incidents reported');
    }
    if (activityParts.length > 0) {
      parts.push(`${activityParts.join('. ')}.`);
    }

    const notableNotes = this.getNotableNotes(data.data.notes);
    if (notableNotes.length > 0) {
      parts.push(`Notable notes: ${notableNotes.join(' ')}.`);
    }

    if (parts.length === 0) {
      return 'No updates recorded for this period.';
    }

    return parts.join(' ');
  }

  private getNotableNotes(notes: any[]): string[] {
    if (!notes || notes.length === 0) return [];
    const prioritized = [...notes].sort((a, b) => {
      const aScore = a.category && a.category !== 'general' ? 1 : 0;
      const bScore = b.category && b.category !== 'general' ? 1 : 0;
      return bScore - aScore;
    });
    return prioritized.slice(0, 2).map((note) => this.truncate(note.text, 140));
  }

  private truncate(text: string, maxLength: number): string {
    if (!text) return '';
    const trimmed = String(text).replace(/\s+/g, ' ').trim();
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}.` : trimmed;
  }
}
