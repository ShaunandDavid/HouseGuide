import { type Guide, type InsertGuide } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getGuide(id: string): Promise<Guide | undefined>;
  getGuideByEmail(email: string): Promise<Guide | undefined>;
  createGuide(guide: InsertGuide): Promise<Guide>;
}

export class MemStorage implements IStorage {
  private guides: Map<string, Guide>;

  constructor() {
    this.guides = new Map();
  }

  async getGuide(id: string): Promise<Guide | undefined> {
    return this.guides.get(id);
  }

  async getGuideByEmail(email: string): Promise<Guide | undefined> {
    return Array.from(this.guides.values()).find(
      (guide) => guide.email === email,
    );
  }

  async createGuide(insertGuide: InsertGuide): Promise<Guide> {
    const id = randomUUID();
    const guide: Guide = { 
      ...insertGuide, 
      id, 
      created: new Date().toISOString(), 
      updated: new Date().toISOString() 
    };
    this.guides.set(id, guide);
    return guide;
  }
}

export const storage = new MemStorage();
