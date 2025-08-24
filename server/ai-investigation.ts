import OpenAI from "openai";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class AIInvestigator {
  private issues: any[] = [];
  private codebaseAnalysis: any = {};

  async runFullInvestigation(): Promise<any> {
    console.log("🔍 Starting GPT-5 powered investigation of HouseGuide application...");
    
    // Collect all source files
    const sourceFiles = this.collectSourceFiles();
    
    // Analyze architecture
    const architectureAnalysis = await this.analyzeArchitecture(sourceFiles);
    
    // Security audit
    const securityAudit = await this.performSecurityAudit(sourceFiles);
    
    // Performance analysis
    const performanceAnalysis = await this.analyzePerformance(sourceFiles);
    
    // Database schema review
    const databaseReview = await this.reviewDatabaseSchema();
    
    // Frontend/Backend integration check
    const integrationCheck = await this.checkIntegration();
    
    // Code quality assessment
    const codeQuality = await this.assessCodeQuality(sourceFiles);
    
    // Business logic validation
    const businessLogic = await this.validateBusinessLogic();
    
    // Compile full report
    return this.compileReport({
      architectureAnalysis,
      securityAudit,
      performanceAnalysis,
      databaseReview,
      integrationCheck,
      codeQuality,
      businessLogic
    });
  }

  private collectSourceFiles(): string[] {
    const files: string[] = [];
    const dirs = ['server', 'client/src', 'shared'];
    
    dirs.forEach(dir => {
      this.walkDir(dir, files);
    });
    
    return files;
  }

  private walkDir(dir: string, files: string[]): void {
    try {
      const items = readdirSync(dir);
      items.forEach(item => {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        if (stat.isDirectory() && !item.includes('node_modules')) {
          this.walkDir(fullPath, files);
        } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
          files.push(fullPath);
        }
      });
    } catch (e) {
      // Directory doesn't exist
    }
  }

  private async analyzeArchitecture(files: string[]): Promise<any> {
    const codeSnippets = files.slice(0, 10).map(f => {
      try {
        return `File: ${f}\n${readFileSync(f, 'utf8').substring(0, 500)}`;
      } catch {
        return '';
      }
    }).join('\n---\n');

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a senior software architect analyzing a residential care facility management application. Provide detailed technical analysis."
        },
        {
          role: "user",
          content: `Analyze the architecture of this HouseGuide application based on these code samples and identify any architectural issues or improvements needed:\n\n${codeSnippets}`
        }
      ],
      max_completion_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  private async performSecurityAudit(files: string[]): Promise<any> {
    // Read auth and security related files
    const securityFiles = files.filter(f => 
      f.includes('auth') || f.includes('security') || f.includes('routes')
    );
    
    const authCode = securityFiles.slice(0, 3).map(f => {
      try {
        return readFileSync(f, 'utf8').substring(0, 1000);
      } catch {
        return '';
      }
    }).join('\n');

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a cybersecurity expert. Analyze this code for security vulnerabilities and provide specific recommendations. Output as JSON with format: {vulnerabilities: [], recommendations: [], riskLevel: string}"
        },
        {
          role: "user",
          content: `Perform a security audit on this authentication and routing code from HouseGuide:\n\n${authCode}\n\nIdentify specific vulnerabilities like SQL injection, XSS, CSRF, weak authentication, etc.`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  private async analyzePerformance(files: string[]): Promise<any> {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a performance optimization expert. Analyze potential performance bottlenecks in a React/Express application with PostgreSQL. Respond in JSON format."
        },
        {
          role: "user",
          content: `Analyze performance considerations for HouseGuide app with these characteristics:
          - React frontend with OCR (Tesseract.js)
          - Express backend with JWT auth
          - PostgreSQL with Drizzle ORM
          - File uploads and document processing
          - Weekly report generation
          
          Identify bottlenecks and optimization opportunities.`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  private async reviewDatabaseSchema(): Promise<any> {
    let schemaContent = '';
    try {
      schemaContent = readFileSync('shared/schema.ts', 'utf8').substring(0, 3000);
    } catch {
      schemaContent = 'Schema file not found';
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a database architect specializing in healthcare data management. Review this schema for a residential care facility system. Output JSON with: {issues: [], improvements: [], dataIntegrity: string, scalability: string}"
        },
        {
          role: "user",
          content: `Review this database schema for HouseGuide residential care management:\n\n${schemaContent}\n\nConsider HIPAA compliance, data relationships, indexing, and scalability.`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  private async checkIntegration(): Promise<any> {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a full-stack developer expert. Analyze frontend-backend integration issues. Respond in JSON."
        },
        {
          role: "user",
          content: `Analyze these integration points in HouseGuide:
          1. Cookie-based JWT authentication between React and Express
          2. CORS configuration with credentials
          3. File upload from React to Express with authentication
          4. React Query with server state management
          5. Error handling across the stack
          
          Known issues: JWT malformed errors were occurring`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  private async assessCodeQuality(files: string[]): Promise<any> {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a code quality expert. Assess the overall code quality of a TypeScript/React/Express application. Output detailed JSON analysis."
        },
        {
          role: "user",
          content: `Assess code quality for HouseGuide based on:
          - TypeScript usage and type safety
          - Error handling patterns
          - Code organization and modularity
          - Testing coverage (tests exist in tests/ directory)
          - Documentation and comments
          - DRY/SOLID principles
          
          File count: ${files.length} TypeScript files`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  private async validateBusinessLogic(): Promise<any> {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a healthcare software consultant. Validate business logic for a residential care facility management system worth $20M. Output JSON."
        },
        {
          role: "user",
          content: `Validate business logic for HouseGuide with these features:
          1. Resident management (active/inactive/graduated status)
          2. Document scanning with OCR classification (commitments/writeups)
          3. Weekly report generation
          4. Multi-house support with access control
          5. Goal tracking, checklists, chores, incidents, meetings
          6. Program fees tracking
          
          Consider regulatory compliance, workflow efficiency, and data integrity.`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  private async compileReport(analyses: any): Promise<any> {
    const summary = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are the CTO providing an executive summary of a $20M application investigation. Be thorough but concise. Output structured JSON report."
        },
        {
          role: "user",
          content: `Compile executive investigation report for HouseGuide based on these analyses:
          
          ${JSON.stringify(analyses, null, 2)}
          
          Include:
          1. Critical issues found
          2. Security vulnerabilities
          3. Performance bottlenecks
          4. Business logic gaps
          5. Technical debt assessment
          6. Risk assessment (1-10 scale)
          7. Recommended immediate actions
          8. Long-term improvements
          9. Estimated effort for fixes
          10. Overall production readiness score (0-100%)`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 3000
    });

    return JSON.parse(summary.choices[0].message.content || "{}");
  }
}

// Run investigation
export async function runAIInvestigation() {
  const investigator = new AIInvestigator();
  const report = await investigator.runFullInvestigation();
  return report;
}