import type { AIProvider, WeeklyReportData } from '../index';

export class GPT4AllProvider implements AIProvider {
  constructor() {
    // GPT4All provider - placeholder for local implementation
    console.log('GPT4All provider initialized (local model)');
  }

  async isAvailable(): Promise<boolean> {
    // For now, return false as GPT4All requires local model setup
    // In production, this would check for local model availability
    return false;
  }

  async generateWeeklyReport(data: WeeklyReportData, template: string): Promise<string> {
    // Placeholder implementation
    // In production, this would integrate with GPT4All local model
    throw new Error('GPT4All provider not yet implemented - use OpenAI or Ollama');
  }
}