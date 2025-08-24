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
    return `You are a professional residential care facility staff member. Generate a weekly progress report following the exact template structure provided.

TEMPLATE:
${template}

RESIDENT: ${data.resident.firstName} ${data.resident.lastInitial}
FACILITY: ${data.house.name}
PERIOD: ${data.period.weekStart} to ${data.period.weekEnd}

DATA:
${this.formatDataForPrompt(data)}

REQUIREMENTS:
- Follow template structure exactly
- Use "No updates this week" for empty sections
- Be professional and factual
- Do not invent information

REPORT:`;
  }

  private formatDataForPrompt(data: WeeklyReportData): string {
    // Reuse the same formatting logic as OpenAI provider
    const sections = [];

    if (data.data.goals.length > 0) {
      sections.push(`Goals: ${data.data.goals.map(g => `${g.title} (${g.status})`).join(', ')}`);
    }
    if (data.data.accomplishments.length > 0) {
      sections.push(`Accomplishments: ${data.data.accomplishments.map(a => a.title).join(', ')}`);
    }
    if (data.data.incidents.length > 0) {
      sections.push(`Incidents: ${data.data.incidents.map(i => `${i.incidentType} (${i.severity})`).join(', ')}`);
    }
    if (data.data.meetings.length > 0) {
      sections.push(`Meetings: ${data.data.meetings.map(m => m.meetingType).join(', ')}`);
    }

    return sections.length > 0 ? sections.join('\n') : 'No activities recorded this week';
  }
}