import { OpenAIProvider } from './providers/openai';

// Conditional imports to avoid module errors
let OllamaProvider: any, GPT4AllProvider: any;
try {
  OllamaProvider = require('./providers/ollama').OllamaProvider;
  GPT4AllProvider = require('./providers/gpt4all').GPT4AllProvider;
} catch (error) {
  // Providers not available
}

export interface WeeklyReportData {
  resident: {
    id: string;
    firstName: string;
    lastInitial: string;
  };
  house: {
    id: string;
    name: string;
  };
  period: {
    weekStart: string;
    weekEnd: string;
  };
  data: {
    goals: any[];
    chores: any[];
    accomplishments: any[];
    incidents: any[];
    meetings: any[];
    programFees: any[];
    notes: any[];
    checklist: any;
  };
}

export interface AIProvider {
  generateWeeklyReport(data: WeeklyReportData, template: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

export class AIService {
  private provider: AIProvider;

  constructor() {
    const aiProvider = process.env.AI_PROVIDER || 'openai';
    
    switch (aiProvider.toLowerCase()) {
      case 'openai':
        this.provider = new OpenAIProvider();
        break;
      case 'ollama':
        this.provider = new OllamaProvider();
        break;
      case 'gpt4all':
        this.provider = new GPT4AllProvider();
        break;
      default:
        throw new Error(`Unsupported AI provider: ${aiProvider}`);
    }
  }

  async generateWeeklyReport(data: WeeklyReportData, template: string): Promise<string> {
    // Validate provider is available
    const isAvailable = await this.provider.isAvailable();
    if (!isAvailable) {
      throw new Error('AI provider is not available');
    }

    return this.provider.generateWeeklyReport(data, template);
  }

  async isProviderAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }
}

// Singleton instance
export const aiService = new AIService();