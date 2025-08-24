import OpenAI from 'openai';
import type { AIProvider, WeeklyReportData } from '../index';

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

    const systemPrompt = `You are a professional residential care facility staff member writing weekly progress reports. 

STRICT REQUIREMENTS:
1. Follow the provided template structure EXACTLY
2. Use professional, clinical language appropriate for facility documentation
3. For empty sections, write "No updates this week" 
4. Be factual and objective - only report on actual data provided
5. Do not invent or hallucinate information
6. Maintain resident confidentiality (use first name + last initial only)
7. Focus on progress, challenges, and next steps

Return ONLY the completed report following the exact template structure.`;

    const userPrompt = `Generate a weekly report for ${data.resident.firstName} ${data.resident.lastInitial} at ${data.house.name} for the week of ${data.period.weekStart} to ${data.period.weekEnd}.

TEMPLATE TO FOLLOW:
${template}

DATA AVAILABLE:
${this.formatDataForPrompt(data)}

Remember: Follow the template structure exactly. Use "No updates this week" for any sections without data.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // Use the latest model as specified in the blueprint
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Low temperature for consistent, factual output
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

    // Goals
    if (data.data.goals.length > 0) {
      sections.push(`GOALS (${data.data.goals.length} total):`);
      data.data.goals.forEach(goal => {
        sections.push(`- ${goal.title} (${goal.status}) - ${goal.description || 'No description'}`);
      });
    } else {
      sections.push('GOALS: None recorded this week');
    }

    // Accomplishments
    if (data.data.accomplishments.length > 0) {
      sections.push(`\nACCOMPLISHMENTS (${data.data.accomplishments.length} total):`);
      data.data.accomplishments.forEach(acc => {
        sections.push(`- ${acc.title} (${acc.category}) - ${acc.description || 'No description'}`);
      });
    } else {
      sections.push('\nACCOMPLISHMENTS: None recorded this week');
    }

    // Chores
    if (data.data.chores.length > 0) {
      sections.push(`\nCHORES (${data.data.chores.length} total):`);
      data.data.chores.forEach(chore => {
        sections.push(`- ${chore.choreName} (${chore.status}) - Due: ${chore.dueDate || 'No due date'}`);
      });
    } else {
      sections.push('\nCHORES: None assigned this week');
    }

    // Incidents
    if (data.data.incidents.length > 0) {
      sections.push(`\nINCIDENTS (${data.data.incidents.length} total):`);
      data.data.incidents.forEach(incident => {
        sections.push(`- ${incident.incidentType} (${incident.severity}) - ${incident.description}`);
      });
    } else {
      sections.push('\nINCIDENTS: None reported this week');
    }

    // Meetings
    if (data.data.meetings.length > 0) {
      sections.push(`\nMEETINGS (${data.data.meetings.length} total):`);
      data.data.meetings.forEach(meeting => {
        sections.push(`- ${meeting.meetingType} on ${meeting.dateAttended} - ${meeting.notes || 'No notes'}`);
      });
    } else {
      sections.push('\nMEETINGS: None attended this week');
    }

    // Program Fees
    if (data.data.programFees.length > 0) {
      sections.push(`\nPROGRAM FEES (${data.data.programFees.length} total):`);
      data.data.programFees.forEach(fee => {
        sections.push(`- $${fee.amount} ${fee.feeType} (${fee.status}) - Due: ${fee.dueDate}`);
      });
    } else {
      sections.push('\nPROGRAM FEES: None this week');
    }

    // Notes
    if (data.data.notes.length > 0) {
      sections.push(`\nNOTES (${data.data.notes.length} total):`);
      data.data.notes.forEach(note => {
        const preview = note.text.length > 100 ? note.text.substring(0, 100) + '...' : note.text;
        sections.push(`- ${note.source === 'ocr' ? '[OCR]' : '[Manual]'} ${preview}`);
      });
    } else {
      sections.push('\nNOTES: None recorded this week');
    }

    return sections.join('\n');
  }
}