import type { AIProvider, WeeklyReportData } from '../index';

export class OllamaProvider implements AIProvider {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async generateWeeklyReport(data: WeeklyReportData, template: string): Promise<string> {
    const prompt = this.buildPrompt(data, template);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.1:8b-instruct',
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 2000,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.response?.trim() || '';
    } catch (error) {
      console.error('Ollama API error:', error);
      throw new Error(`Failed to generate report with Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPrompt(data: WeeklyReportData, template: string): string {
    const rulesBlockParts: string[] = [];
    if (data.organization?.defaultRules) {
      rulesBlockParts.push(`ORGANIZATION RULES:\n${data.organization.defaultRules}`);
    }
    if (data.house.rules) {
      rulesBlockParts.push(`HOUSE RULES:\n${data.house.rules}`);
    }
    const rulesBlock = rulesBlockParts.length
      ? `${rulesBlockParts.join('\n\n')}\n\n`
      : '';

    return `You are a professional residential care facility staff member. Generate a weekly progress report following the exact template structure provided.

TEMPLATE:
${template}

RESIDENT: ${data.resident.firstName} ${data.resident.lastInitial}
FACILITY: ${data.house.name}
PERIOD: ${data.period.weekStart} to ${data.period.weekEnd}

DATA:
${rulesBlock}${this.formatDataForPrompt(data)}

REQUIREMENTS:
- Follow template structure exactly
- Use "No updates this week" for empty sections
- Be professional and factual
- If entries conflict, prefer the most recent timestamp
- Do not invent information

REPORT:`;
  }

  private formatDataForPrompt(data: WeeklyReportData): string {
    const sections = [];

    if (data.data.checklist) {
      const checklist = data.data.checklist;
      const checklistTimestamp = this.getRecordTimestamp(checklist);
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

    if (data.data.goals.length > 0) {
      sections.push(`GOALS (${data.data.goals.length} total):`);
      data.data.goals.forEach(goal => {
        const meta = this.formatEntryMeta(goal, [{ field: 'targetDate', label: 'Target' }]);
        sections.push(`- ${goal.title} (${goal.status})${meta}`);
      });
    }
    if (data.data.accomplishments.length > 0) {
      sections.push(`\nACCOMPLISHMENTS (${data.data.accomplishments.length} total):`);
      data.data.accomplishments.forEach(acc => {
        const meta = this.formatEntryMeta(acc, [{ field: 'dateAchieved', label: 'Achieved' }]);
        sections.push(`- ${acc.title} (${acc.category || 'other'})${meta}`);
      });
    }
    if (data.data.chores.length > 0) {
      sections.push(`\nCHORES (${data.data.chores.length} total):`);
      data.data.chores.forEach(chore => {
        const meta = this.formatEntryMeta(chore, [
          { field: 'assignedDate', label: 'Assigned' },
          { field: 'dueDate', label: 'Due' }
        ]);
        sections.push(`- ${chore.choreName} (${chore.status})${meta}`);
      });
    }
    if (data.data.incidents.length > 0) {
      sections.push(`\nINCIDENTS (${data.data.incidents.length} total):`);
      data.data.incidents.forEach(incident => {
        const meta = this.formatEntryMeta(incident, [{ field: 'dateOccurred', label: 'Date' }]);
        sections.push(`- ${incident.incidentType} (${incident.severity})${meta}`);
      });
    }
    if (data.data.meetings.length > 0) {
      sections.push(`\nMEETINGS (${data.data.meetings.length} total):`);
      data.data.meetings.forEach(meeting => {
        const meta = this.formatEntryMeta(meeting, [{ field: 'dateAttended', label: 'Date' }]);
        sections.push(`- ${meeting.meetingType}${meta}`);
      });
    }
    if (data.data.programFees.length > 0) {
      sections.push(`\nPROGRAM FEES (${data.data.programFees.length} total):`);
      data.data.programFees.forEach(fee => {
        const meta = this.formatEntryMeta(fee, [
          { field: 'dueDate', label: 'Due' },
          { field: 'paidDate', label: 'Paid' }
        ]);
        sections.push(`- $${fee.amount} ${fee.feeType} (${fee.status})${meta}`);
      });
    }
    if (data.data.notes.length > 0) {
      sections.push(`\nNOTES (${data.data.notes.length} total):`);
      data.data.notes.forEach(note => {
        const meta = this.formatEntryMeta(note);
        sections.push(`- ${note.text}${meta}`);
      });
    }
    if (data.data.files && data.data.files.length > 0) {
      sections.push(`\nDOCUMENTS (${data.data.files.length} total):`);
      data.data.files.forEach((file: any) => {
        const meta = this.formatEntryMeta(file);
        sections.push(`- ${file.type || 'document'} - ${file.filename || 'Unnamed file'}${meta}`);
      });
    }

    return sections.length > 0 ? sections.join('\n') : 'No activities recorded this week';
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
}
