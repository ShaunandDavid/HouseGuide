import { eq } from "drizzle-orm";
import { db } from "./db";
import { 
  guides, houses, residents, files, reports, weeklyReports, goals, 
  checklists, chores, accomplishments, incidents, meetings, 
  programFees, notes 
} from "@shared/schema";
import type { IStorage } from "./storage";
import type { 
  Guide, House, Resident, FileRecord, Note, Report, WeeklyReport,
  Goal, Checklist, Chore, Accomplishment, Incident, Meeting, ProgramFee,
  InsertGuide, InsertHouse, InsertResident, InsertFile, InsertNote, InsertReport, InsertWeeklyReport,
  InsertGoal, InsertChecklist, InsertChore, InsertAccomplishment, InsertIncident, InsertMeeting, InsertProgramFee
} from "@shared/schema";
import { randomUUID } from "crypto";

export class DbStorage implements IStorage {
  // Guides
  async getGuide(id: string): Promise<Guide | undefined> {
    const result = await db.select().from(guides).where(eq(guides.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }

  async getGuideByEmail(email: string): Promise<Guide | undefined> {
    const result = await db.select().from(guides).where(eq(guides.email, email)).limit(1);
    if (result.length === 0) return undefined;
    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }

  async getGuideByVerificationToken(token: string): Promise<Guide | undefined> {
    const result = await db.select().from(guides).where(eq(guides.verificationToken, token)).limit(1);
    if (result.length === 0) return undefined;
    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }

  async createGuide(insertGuide: InsertGuide): Promise<Guide> {
    const verificationToken = randomUUID();
    
    // Create the house first
    const house = await this.createHouse({ name: insertGuide.houseName });
    
    const result = await db.insert(guides).values({
      email: insertGuide.email,
      name: insertGuide.name,
      password: insertGuide.password,
      houseName: insertGuide.houseName,
      houseId: house.id,
      isEmailVerified: false,
      verificationToken,
    }).returning();
    
    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }

  async updateGuide(id: string, updates: Partial<Guide>): Promise<Guide> {
    const result = await db.update(guides)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(guides.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Guide not found');
    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }
  
  // Houses
  async getHouse(id: string): Promise<House | undefined> {
    const result = await db.select().from(houses).where(eq(houses.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const house = result[0];
    return {
      ...house,
      created: house.created.toISOString(),
      updated: house.updated.toISOString(),
    } as House;
  }

  async getHouseByName(name: string): Promise<House | undefined> {
    const result = await db.select().from(houses).where(eq(houses.name, name)).limit(1);
    if (result.length === 0) return undefined;
    const house = result[0];
    return {
      ...house,
      created: house.created.toISOString(),
      updated: house.updated.toISOString(),
    } as House;
  }

  async createHouse(insertHouse: InsertHouse): Promise<House> {
    const result = await db.insert(houses).values({
      name: insertHouse.name,
    }).returning();
    
    const house = result[0];
    return {
      ...house,
      created: house.created.toISOString(),
      updated: house.updated.toISOString(),
    } as House;
  }

  async getAllHouses(): Promise<House[]> {
    const result = await db.select().from(houses);
    return result.map(house => ({
      ...house,
      created: house.created.toISOString(),
      updated: house.updated.toISOString(),
    })) as House[];
  }
  
  // Residents
  async getResident(id: string): Promise<Resident | undefined> {
    const result = await db.select().from(residents).where(eq(residents.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const resident = result[0];
    return {
      ...resident,
      created: resident.created.toISOString(),
      updated: resident.updated.toISOString(),
    } as Resident;
  }

  async getResidentsByHouse(houseId: string, limit?: number, offset?: number): Promise<Resident[]> {
    let query = db.select().from(residents).where(eq(residents.house, houseId));
    if (limit) query = query.limit(limit) as any;
    if (offset) query = query.offset(offset) as any;
    
    const result = await query;
    return result.map(resident => ({
      ...resident,
      created: resident.created.toISOString(),
      updated: resident.updated.toISOString(),
    })) as Resident[];
  }

  async createResident(insertResident: InsertResident): Promise<Resident> {
    const result = await db.insert(residents).values(insertResident).returning();
    const resident = result[0];
    return {
      ...resident,
      created: resident.created.toISOString(),
      updated: resident.updated.toISOString(),
    } as Resident;
  }

  async updateResident(id: string, updates: Partial<InsertResident>): Promise<Resident> {
    const result = await db.update(residents)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(residents.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Resident not found');
    const resident = result[0];
    return {
      ...resident,
      created: resident.created.toISOString(),
      updated: resident.updated.toISOString(),
    } as Resident;
  }

  async deleteResident(id: string): Promise<void> {
    await db.delete(residents).where(eq(residents.id, id));
  }
  
  // Files
  async getFile(id: string): Promise<FileRecord | undefined> {
    const result = await db.select().from(files).where(eq(files.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const file = result[0];
    return {
      ...file,
      created: file.created.toISOString(),
      updated: file.updated.toISOString(),
    } as FileRecord;
  }

  async getFilesByResident(residentId: string): Promise<FileRecord[]> {
    const result = await db.select().from(files).where(eq(files.resident, residentId));
    return result.map(file => ({
      ...file,
      created: file.created.toISOString(),
      updated: file.updated.toISOString(),
    })) as FileRecord[];
  }

  async createFile(insertFile: InsertFile): Promise<FileRecord> {
    const result = await db.insert(files).values(insertFile).returning();
    const file = result[0];
    return {
      ...file,
      created: file.created.toISOString(),
      updated: file.updated.toISOString(),
    } as FileRecord;
  }

  async deleteFile(id: string): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }
  
  // Reports
  async getReport(id: string): Promise<Report | undefined> {
    const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as Report;
  }

  async getReportByResidentAndWeek(residentId: string, weekStart: string): Promise<Report | undefined> {
    const result = await db.select().from(reports)
      .where(eq(reports.resident, residentId))
      .where(eq(reports.weekStart, weekStart))
      .limit(1);
    if (result.length === 0) return undefined;
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as Report;
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const result = await db.insert(reports).values(insertReport).returning();
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as Report;
  }

  async updateReport(id: string, updates: Partial<InsertReport>): Promise<Report> {
    const result = await db.update(reports)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Report not found');
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as Report;
  }
  
  // Goals
  async getGoal(id: string): Promise<Goal | undefined> {
    const result = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const goal = result[0];
    return {
      ...goal,
      created: goal.created.toISOString(),
      updated: goal.updated.toISOString(),
    } as Goal;
  }

  async getGoalsByResident(residentId: string): Promise<Goal[]> {
    const result = await db.select().from(goals).where(eq(goals.resident, residentId));
    return result.map(goal => ({
      ...goal,
      created: goal.created.toISOString(),
      updated: goal.updated.toISOString(),
    })) as Goal[];
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const result = await db.insert(goals).values(insertGoal).returning();
    const goal = result[0];
    return {
      ...goal,
      created: goal.created.toISOString(),
      updated: goal.updated.toISOString(),
    } as Goal;
  }

  async updateGoal(id: string, updates: Partial<InsertGoal>): Promise<Goal> {
    const result = await db.update(goals)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(goals.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Goal not found');
    const goal = result[0];
    return {
      ...goal,
      created: goal.created.toISOString(),
      updated: goal.updated.toISOString(),
    } as Goal;
  }

  async deleteGoal(id: string): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id));
  }
  
  // Checklists
  async getChecklist(id: string): Promise<Checklist | undefined> {
    const result = await db.select().from(checklists).where(eq(checklists.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const checklist = result[0];
    return {
      ...checklist,
      created: checklist.created.toISOString(),
      updated: checklist.updated.toISOString(),
    } as Checklist;
  }

  async getChecklistByResident(residentId: string): Promise<Checklist | undefined> {
    const result = await db.select().from(checklists).where(eq(checklists.resident, residentId)).limit(1);
    if (result.length === 0) return undefined;
    const checklist = result[0];
    return {
      ...checklist,
      created: checklist.created.toISOString(),
      updated: checklist.updated.toISOString(),
    } as Checklist;
  }

  async createChecklist(insertChecklist: InsertChecklist): Promise<Checklist> {
    const result = await db.insert(checklists).values(insertChecklist).returning();
    const checklist = result[0];
    return {
      ...checklist,
      created: checklist.created.toISOString(),
      updated: checklist.updated.toISOString(),
    } as Checklist;
  }

  async updateChecklist(id: string, updates: Partial<InsertChecklist>): Promise<Checklist> {
    const result = await db.update(checklists)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(checklists.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Checklist not found');
    const checklist = result[0];
    return {
      ...checklist,
      created: checklist.created.toISOString(),
      updated: checklist.updated.toISOString(),
    } as Checklist;
  }
  
  // Chores
  async getChore(id: string): Promise<Chore | undefined> {
    const result = await db.select().from(chores).where(eq(chores.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const chore = result[0];
    return {
      ...chore,
      created: chore.created.toISOString(),
      updated: chore.updated.toISOString(),
    } as Chore;
  }

  async getChoresByResident(residentId: string): Promise<Chore[]> {
    const result = await db.select().from(chores).where(eq(chores.resident, residentId));
    return result.map(chore => ({
      ...chore,
      created: chore.created.toISOString(),
      updated: chore.updated.toISOString(),
    })) as Chore[];
  }

  async createChore(insertChore: InsertChore): Promise<Chore> {
    const result = await db.insert(chores).values(insertChore).returning();
    const chore = result[0];
    return {
      ...chore,
      created: chore.created.toISOString(),
      updated: chore.updated.toISOString(),
    } as Chore;
  }

  async updateChore(id: string, updates: Partial<InsertChore>): Promise<Chore> {
    const result = await db.update(chores)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(chores.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Chore not found');
    const chore = result[0];
    return {
      ...chore,
      created: chore.created.toISOString(),
      updated: chore.updated.toISOString(),
    } as Chore;
  }

  async deleteChore(id: string): Promise<void> {
    await db.delete(chores).where(eq(chores.id, id));
  }
  
  // Accomplishments
  async getAccomplishment(id: string): Promise<Accomplishment | undefined> {
    const result = await db.select().from(accomplishments).where(eq(accomplishments.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const accomplishment = result[0];
    return {
      ...accomplishment,
      created: accomplishment.created.toISOString(),
      updated: accomplishment.updated.toISOString(),
    } as Accomplishment;
  }

  async getAccomplishmentsByResident(residentId: string): Promise<Accomplishment[]> {
    const result = await db.select().from(accomplishments).where(eq(accomplishments.resident, residentId));
    return result.map(accomplishment => ({
      ...accomplishment,
      created: accomplishment.created.toISOString(),
      updated: accomplishment.updated.toISOString(),
    })) as Accomplishment[];
  }

  async createAccomplishment(insertAccomplishment: InsertAccomplishment): Promise<Accomplishment> {
    const result = await db.insert(accomplishments).values(insertAccomplishment).returning();
    const accomplishment = result[0];
    return {
      ...accomplishment,
      created: accomplishment.created.toISOString(),
      updated: accomplishment.updated.toISOString(),
    } as Accomplishment;
  }

  async updateAccomplishment(id: string, updates: Partial<InsertAccomplishment>): Promise<Accomplishment> {
    const result = await db.update(accomplishments)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(accomplishments.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Accomplishment not found');
    const accomplishment = result[0];
    return {
      ...accomplishment,
      created: accomplishment.created.toISOString(),
      updated: accomplishment.updated.toISOString(),
    } as Accomplishment;
  }

  async deleteAccomplishment(id: string): Promise<void> {
    await db.delete(accomplishments).where(eq(accomplishments.id, id));
  }
  
  // Incidents
  async getIncident(id: string): Promise<Incident | undefined> {
    const result = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const incident = result[0];
    return {
      ...incident,
      created: incident.created.toISOString(),
      updated: incident.updated.toISOString(),
    } as Incident;
  }

  async getIncidentsByResident(residentId: string): Promise<Incident[]> {
    const result = await db.select().from(incidents).where(eq(incidents.resident, residentId));
    return result.map(incident => ({
      ...incident,
      created: incident.created.toISOString(),
      updated: incident.updated.toISOString(),
    })) as Incident[];
  }

  async createIncident(insertIncident: InsertIncident): Promise<Incident> {
    const result = await db.insert(incidents).values(insertIncident).returning();
    const incident = result[0];
    return {
      ...incident,
      created: incident.created.toISOString(),
      updated: incident.updated.toISOString(),
    } as Incident;
  }

  async updateIncident(id: string, updates: Partial<InsertIncident>): Promise<Incident> {
    const result = await db.update(incidents)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(incidents.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Incident not found');
    const incident = result[0];
    return {
      ...incident,
      created: incident.created.toISOString(),
      updated: incident.updated.toISOString(),
    } as Incident;
  }

  async deleteIncident(id: string): Promise<void> {
    await db.delete(incidents).where(eq(incidents.id, id));
  }
  
  // Meetings
  async getMeeting(id: string): Promise<Meeting | undefined> {
    const result = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const meeting = result[0];
    return {
      ...meeting,
      created: meeting.created.toISOString(),
      updated: meeting.updated.toISOString(),
    } as Meeting;
  }

  async getMeetingsByResident(residentId: string): Promise<Meeting[]> {
    const result = await db.select().from(meetings).where(eq(meetings.resident, residentId));
    return result.map(meeting => ({
      ...meeting,
      created: meeting.created.toISOString(),
      updated: meeting.updated.toISOString(),
    })) as Meeting[];
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const result = await db.insert(meetings).values(insertMeeting).returning();
    const meeting = result[0];
    return {
      ...meeting,
      created: meeting.created.toISOString(),
      updated: meeting.updated.toISOString(),
    } as Meeting;
  }

  async updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting> {
    const result = await db.update(meetings)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(meetings.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Meeting not found');
    const meeting = result[0];
    return {
      ...meeting,
      created: meeting.created.toISOString(),
      updated: meeting.updated.toISOString(),
    } as Meeting;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }
  
  // Program Fees
  async getProgramFee(id: string): Promise<ProgramFee | undefined> {
    const result = await db.select().from(programFees).where(eq(programFees.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const fee = result[0];
    return {
      ...fee,
      created: fee.created.toISOString(),
      updated: fee.updated.toISOString(),
    } as ProgramFee;
  }

  async getProgramFeesByResident(residentId: string): Promise<ProgramFee[]> {
    const result = await db.select().from(programFees).where(eq(programFees.resident, residentId));
    return result.map(fee => ({
      ...fee,
      created: fee.created.toISOString(),
      updated: fee.updated.toISOString(),
    })) as ProgramFee[];
  }

  async createProgramFee(insertFee: InsertProgramFee): Promise<ProgramFee> {
    const result = await db.insert(programFees).values(insertFee).returning();
    const fee = result[0];
    return {
      ...fee,
      created: fee.created.toISOString(),
      updated: fee.updated.toISOString(),
    } as ProgramFee;
  }

  async updateProgramFee(id: string, updates: Partial<InsertProgramFee>): Promise<ProgramFee> {
    const result = await db.update(programFees)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(programFees.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Program fee not found');
    const fee = result[0];
    return {
      ...fee,
      created: fee.created.toISOString(),
      updated: fee.updated.toISOString(),
    } as ProgramFee;
  }

  async deleteProgramFee(id: string): Promise<void> {
    await db.delete(programFees).where(eq(programFees.id, id));
  }
  
  // Notes
  async getNote(id: string): Promise<Note | undefined> {
    const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const note = result[0];
    return {
      ...note,
      created: note.created.toISOString(),
      updated: note.updated.toISOString(),
    } as Note;
  }

  async getNotesByResident(residentId: string): Promise<Note[]> {
    const result = await db.select().from(notes).where(eq(notes.residentId, residentId));
    return result.map(note => ({
      ...note,
      created: note.created.toISOString(),
      updated: note.updated.toISOString(),
    })) as Note[];
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const result = await db.insert(notes).values(insertNote).returning();
    const note = result[0];
    return {
      ...note,
      created: note.created.toISOString(),
      updated: note.updated.toISOString(),
    } as Note;
  }

  // Weekly Reports (AI Generated) - DbStorage implementation
  async getWeeklyReport(id: string): Promise<WeeklyReport | undefined> {
    const result = await db.select().from(weeklyReports).where(eq(weeklyReports.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as WeeklyReport;
  }

  async getWeeklyReportsByResident(residentId: string, from?: string, to?: string): Promise<WeeklyReport[]> {
    let query = db.select().from(weeklyReports).where(eq(weeklyReports.residentId, residentId));
    
    // TODO: Add date filtering when needed
    // if (from) query = query.where(gte(weeklyReports.weekStart, from));
    // if (to) query = query.where(lte(weeklyReports.weekEnd, to));
    
    const result = await query;
    return result.map(report => ({
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    })) as WeeklyReport[];
  }

  async createWeeklyReport(insertReport: InsertWeeklyReport): Promise<WeeklyReport> {
    const result = await db.insert(weeklyReports).values(insertReport).returning();
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as WeeklyReport;
  }

  async updateWeeklyReport(id: string, updates: Partial<InsertWeeklyReport>): Promise<WeeklyReport> {
    const result = await db.update(weeklyReports)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(weeklyReports.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Weekly report not found');
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as WeeklyReport;
  }

  async deleteWeeklyReport(id: string): Promise<void> {
    await db.delete(weeklyReports).where(eq(weeklyReports.id, id));
  }
}